"""Shared CRM data for every browser: leads, sales, assignments, settings, ...

The CRM screens keep their working copy in the browser; this module is what makes that copy the
same for everyone. Browsers pull what changed since their last cursor (GET /api/sync) and push
the records they changed (POST /api/sync). Each collection has a policy that decides who may
read and write which records, enforced here on every pull and push, so a browser only ever
receives the records its user may see.
"""
import json
import time
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

try:
    from backend import store
    from backend.auth import get_current_user, is_admin, role_rank
    from backend.broadcasts import DELETED_PAID, forget_paid_client
except ImportError:
    import store
    from auth import get_current_user, is_admin, role_rank
    from broadcasts import DELETED_PAID, forget_paid_client


router = APIRouter(prefix="/api/sync", tags=["sync"])
MAX_PUSH_RECORDS = 5000
MAX_RECORD_CHARS = 2_000_000
UNASSIGNED = {"", "unassigned", None}


# ==========================================
# Who owns what
# ==========================================
def _lead_owner(lead: dict) -> Optional[str]:
    if lead.get("isUnassigned") or lead.get("assignedToName") == "Unassigned":
        return None
    owner = lead.get("assignedToId") or lead.get("assigned_user_id")
    return None if owner in UNASSIGNED else owner


_TEAM_TTL_SECONDS = 30
_team_cache: Dict[str, tuple] = {}  # user id -> (expires, ids); every browser polls, so cache briefly


def team_ids(user: dict) -> set:
    """The user plus everyone who reports to them, directly or indirectly (reportingTo holds a name)."""
    cached = _team_cache.get(user["id"])
    if cached and cached[0] > time.monotonic() and cached[2] == (user.get("name"), user.get("role")):
        return cached[1]
    ids = _compute_team(user)
    _team_cache[user["id"]] = (time.monotonic() + _TEAM_TTL_SECONDS, ids, (user.get("name"), user.get("role")))
    return ids


def _compute_team(user: dict) -> set:
    users = store.all("users")
    by_manager: Dict[str, list] = {}
    for u in users:
        by_manager.setdefault((u.get("reportingTo") or "").strip().lower(), []).append(u)
    ids, queue = {user["id"]}, [user]
    while queue:
        for report in by_manager.get((queue.pop().get("name") or "").strip().lower(), []):
            if report["id"] not in ids:
                ids.add(report["id"])
                queue.append(report)
    return ids


# ==========================================
# Collection policies
# ==========================================
ADMIN, SUPER_ADMIN, SCOPED, EVERYONE = "admin", "super_admin", "scoped", "everyone"


@dataclass
class Policy:
    read: str                     # ADMIN, SCOPED (owner in the user's team) or EVERYONE
    write: str                    # ADMIN, SUPER_ADMIN, SCOPED or EVERYONE
    owner: Optional[Callable[[dict], Optional[str]]] = None
    delete_min_rank: int = 0      # SCOPED deletes also need at least this role rank
    visible: Optional[Callable[[dict, dict], bool]] = None   # extra read filter (user, record)
    redact: Optional[Callable[[dict, dict], dict]] = None    # strip fields for this user
    check: Optional[Callable[[dict, Optional[dict], Optional[dict]], Optional[str]]] = None  # (user, old, new|None) -> error
    on_delete: Optional[Callable[[str], None]] = None  # replaces the plain delete


# Exact values the CRM screens use when a sale is submitted, and when one is sent back
NEW_SALE_STATUSES = {"Pending Super Admin Review", "Pending Super Admin Approval"}
NEW_SALE_STAGES = {None, "", "Under Review by Super Admin", "Sale Submitted"}
OPEN_SALE_STATUSES = NEW_SALE_STATUSES | {"Rejected by Super Admin", "Rejected"}


def _open_sale(sale: Optional[dict]) -> bool:
    """Still in the hands of the person who submitted it: awaiting review, or sent back."""
    return (sale or {}).get("status") in OPEN_SALE_STATUSES


def _sale_check(user: dict, old: Optional[dict], new: Optional[dict]) -> Optional[str]:
    # Review, approval and e-sign are Super Admin actions (the Leegality endpoints are Super Admin only)
    if user["role"] == "Super Admin":
        return None
    if new is None:
        return None if _open_sale(old) else "Only a Super Admin can delete a sale that is under way."
    if old is None:
        if new.get("status") in NEW_SALE_STATUSES and new.get("stage") in NEW_SALE_STAGES:
            return None
        return "New sales must start as pending Super Admin review."
    if not _open_sale(old):
        return "This sale is under review or approved; only a Super Admin can change it."
    if new.get("status") != old.get("status") or new.get("stage") != old.get("stage"):
        return "Only a Super Admin can move a sale through review and approval."
    return None


def _paid_check(user: dict, old: Optional[dict], new: Optional[dict]) -> Optional[str]:
    # Telegram trade calls go to every stored Paid client, so a deleted one must stay deleted
    if new is not None and new.get("id") in store.get_value(DELETED_PAID, []):
        return "This Paid client was deleted."
    return None


def _notification_visible(user: dict, note: dict) -> bool:
    target_user, target_role = note.get("targetUserId"), note.get("targetRole")
    if not target_user and not target_role:
        return True
    return user["id"] == target_user or user["role"] == target_role or is_admin(user)


def _notification_check(user: dict, old: Optional[dict], new: Optional[dict]) -> Optional[str]:
    """Anyone may post a notification (as themselves) and mark ones they can see as read; only the
    author, the person it is addressed to, or an admin may delete it, and only admins edit others' text."""
    if is_admin(user):
        return None
    if old is None:
        if new.get("createdByUserId") not in (None, user["id"]):
            return "Notifications are posted as yourself."
        new["createdByUserId"] = user["id"]
        return None
    mine = old.get("createdByUserId") == user["id"] or old.get("targetUserId") == user["id"]
    if not mine and not _notification_visible(user, old):
        return "This notification is not addressed to you."
    if new is None:
        return None if mine else "Only its author or addressee can delete this notification."
    if not mine and {k: v for k, v in new.items() if k != "read"} != {k: v for k, v in old.items() if k != "read"}:
        return "You can only mark this notification as read."
    return None


def _redact_passwords(user: dict, doc: dict) -> dict:
    # Settings may carry override passwords; only admins receive them
    if is_admin(user) or "password" not in doc["id"].lower():
        return doc
    return {**doc, "value": None}


def _own_entry(user: dict, doc: dict) -> bool:
    return is_admin(user) or doc.get("id") == user["id"]


POLICIES: Dict[str, Policy] = {
    "leads": Policy(read=SCOPED, write=SCOPED, owner=_lead_owner, delete_min_rank=role_rank("Team Leader")),
    "sales": Policy(read=SCOPED, write=SCOPED, check=_sale_check,
                    owner=lambda s: s.get("submittedByUserId") or s.get("employeeId")),
    "assignmentInstances": Policy(read=SCOPED, write=SCOPED, delete_min_rank=role_rank("Team Leader"),
                                  owner=lambda i: i.get("assignedToId") or i.get("assigned_user_id")),
    "leadRequests": Policy(read=SCOPED, write=SCOPED, owner=lambda r: r.get("requestedByUserId")),
    "notifications": Policy(read=EVERYONE, write=EVERYONE, visible=_notification_visible, check=_notification_check),
    "userShortcutSettings": Policy(read=SCOPED, write=SCOPED, owner=lambda s: s.get("userId")),
    "masterRecords": Policy(read=ADMIN, write=ADMIN),
    "eSignRecords": Policy(read=ADMIN, write=ADMIN),
    "paidClients": Policy(read=ADMIN, write=ADMIN, check=_paid_check, on_delete=forget_paid_client),
    "services": Policy(read=EVERYONE, write=SUPER_ADMIN),
    "userCustomFields": Policy(read=EVERYONE, write=SUPER_ADMIN),
    # Key/value collections: one record {"id": key, "value": ...} per top-level key
    "userPermissions": Policy(read=EVERYONE, write=SUPER_ADMIN, visible=_own_entry),
    "financialSettings": Policy(read=EVERYONE, write=SUPER_ADMIN, redact=_redact_passwords),
    "voiceAgentSettings": Policy(read=EVERYONE, write=SUPER_ADMIN),
}

for _collection, _rules in POLICIES.items():
    if _rules.owner:
        store.register_owner(_collection, _rules.owner)


def _policy(name: str) -> Policy:
    if name not in POLICIES:
        raise HTTPException(status_code=404, detail=f"Unknown collection '{name}'.")
    return POLICIES[name]


class _Viewer:
    """What one request's user may see; the team is computed once, on first use."""

    def __init__(self, user: dict):
        self.user = user
        self.admin = is_admin(user)
        self._team = None

    @property
    def team(self) -> set:
        if self._team is None:
            self._team = team_ids(self.user)
        return self._team

    def can_read(self, policy: Policy, owner: Optional[str], doc: Optional[dict]) -> bool:
        if policy.read == ADMIN and not self.admin:
            return False
        if policy.read == SCOPED and not self.admin and owner not in self.team:
            return False
        return not (policy.visible and doc is not None and not policy.visible(self.user, doc))

    def present(self, policy: Policy, doc: dict) -> dict:
        return policy.redact(self.user, doc) if policy.redact else doc

    def write_error(self, policy: Policy, old: Optional[dict], new: Optional[dict]) -> Optional[str]:
        """Why this user may not replace `old` with `new` (None = delete), or None when allowed."""
        role = self.user["role"]
        if policy.write == SUPER_ADMIN and role != "Super Admin":
            return "Only a Super Admin can change this."
        if policy.write == ADMIN and not self.admin:
            return "Only an Admin or Super Admin can change this."
        if policy.write == SCOPED and not self.admin:
            for doc in (old, new):
                if doc is not None and policy.owner(doc) not in self.team:
                    return "This record belongs to someone outside your team."
            if new is None and role_rank(role) < policy.delete_min_rank:
                return "Your role cannot delete this record."
        if new is None and policy.delete_min_rank >= role_rank("Admin") and not self.admin:
            return "Only an Admin or Super Admin can delete this record."
        if policy.check:
            return policy.check(self.user, old, new)
        return None


# ==========================================
# API
# ==========================================
@router.get("")
def pull(collections: str = Query(..., description="Comma-separated collection names"),
         since: int = Query(0, ge=0),
         current_user: dict = Depends(get_current_user)):
    """since=0 returns each collection in full; otherwise only what changed after the cursor."""
    names = [n for n in dict.fromkeys(c.strip() for c in collections.split(",")) if n]
    policies = {n: _policy(n) for n in names}
    viewer = _Viewer(current_user)

    if since == 0:
        # Anything written while we read is newer than `cursor` and arrives on the next pull
        cursor = store.cursor()
        parts = []
        for name, policy in policies.items():
            items = []
            if policy.read != ADMIN or viewer.admin:
                owners = None if (policy.read != SCOPED or viewer.admin) else viewer.team
                if policy.visible or policy.redact:
                    items = [json.dumps(viewer.present(policy, doc)) for doc in store.all(name, owners)
                             if viewer.can_read(policy, None, doc)]
                else:
                    # The owner filter already ran in SQL: send the stored JSON as-is, unparsed
                    # (a full lead list is the largest response in the app)
                    items = store.all_json(name, owners)
            parts.append(f'{json.dumps(name)}: {{"items": [{",".join(items)}], "deleted": []}}')
        body = f'{{"full": true, "cursor": {int(cursor)}, "collections": {{{", ".join(parts)}}}}}'
        return Response(body, media_type="application/json")

    scopes = {}
    for name, policy in policies.items():
        if policy.read == ADMIN and not viewer.admin:
            continue
        scopes[name] = viewer.team if (policy.read == SCOPED and not viewer.admin) else None
    feed = store.changes(scopes, since)
    items = {n: [] for n in names}
    deleted = {n: [] for n in names}
    for name, rid, owner, text, is_deleted in feed["rows"]:
        policy = policies[name]
        if is_deleted:
            deleted[name].append(rid)
        elif policy.visible or policy.redact:
            doc = json.loads(text)
            if viewer.can_read(policy, owner, doc):
                items[name].append(json.dumps(viewer.present(policy, doc)))
        else:
            items[name].append(text)  # already filtered by owner in SQL; sent as stored
    # A record reassigned away from this user's team: tell their browser to drop it
    moved = [(n, rid) for n, rid, _ in feed["moves"]]
    if moved:
        for name, rid in moved:
            current = store.get(name, rid)
            if current is None or policies[name].owner(current) not in viewer.team:
                deleted[name].append(rid)
    parts = [f'{json.dumps(n)}: {{"items": [{",".join(items[n])}], "deleted": {json.dumps(list(dict.fromkeys(deleted[n])))}}}'
             for n in names]
    body = f'{{"full": false, "cursor": {int(feed["cursor"])}, "collections": {{{", ".join(parts)}}}}}'
    return Response(body, media_type="application/json")


class CollectionChanges(BaseModel):
    upserts: List[dict] = []
    deletes: List[str] = []


class PushRequest(BaseModel):
    collections: Dict[str, CollectionChanges]


@router.post("")
def push(req: PushRequest, current_user: dict = Depends(get_current_user)):
    """Apply a browser's changes record by record. Records the user may not change are rejected
    (and listed) while the rest are saved, so one bad record never blocks a whole upload."""
    total = sum(len(c.upserts) + len(c.deletes) for c in req.collections.values())
    if total > MAX_PUSH_RECORDS:
        raise HTTPException(status_code=413, detail=f"At most {MAX_PUSH_RECORDS} records per sync request.")
    viewer = _Viewer(current_user)
    saved, rejected = {}, {}

    with store.transaction():
        for name, changes in req.collections.items():
            policy = _policy(name)
            saved[name], rejected[name] = [], []
            existing = store.get_many(name, [d.get("id") for d in changes.upserts if isinstance(d.get("id"), str)]
                                      + [i for i in changes.deletes if isinstance(i, str)])
            writes = {}
            for doc in changes.upserts:
                rid = doc.get("id")
                if not isinstance(rid, str) or not rid or len(rid) > 200:
                    rejected[name].append({"id": rid, "reason": "Every record needs a string id."})
                    continue
                if len(json.dumps(doc)) > MAX_RECORD_CHARS:
                    rejected[name].append({"id": rid, "reason": "Record is too large."})
                    continue
                old = existing.get(rid)
                if policy.redact and old is not None and doc.get("value") is None and old.get("value") is not None:
                    doc = old  # a redacted value coming back unchanged must not wipe the real one
                error = viewer.write_error(policy, old, doc)
                if error:
                    rejected[name].append({"id": rid, "reason": error})
                    continue
                if old != doc:
                    writes[rid] = doc
                saved[name].append(rid)
            store.put_pairs(name, list(writes.items()))
            for rid in changes.deletes:
                old = existing.get(rid)
                if old is None:
                    saved[name].append(rid)  # already gone
                    continue
                error = viewer.write_error(policy, old, None)
                if error:
                    rejected[name].append({"id": rid, "reason": error})
                    continue
                if policy.on_delete:
                    policy.on_delete(rid)
                else:
                    store.delete(name, rid)
                saved[name].append(rid)
    return {"saved": saved, "rejected": rejected, "cursor": store.cursor()}
