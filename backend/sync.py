"""Shared CRM data for every browser: leads, sales, assignments, settings, ...

The CRM screens keep their working copy in the browser; this module is what makes that copy the
same for everyone. Browsers pull what changed since their last cursor (GET /api/sync) and push
the records they changed (POST /api/sync). Each collection has a policy that decides who may
read and write which records, enforced here on every pull and push, so a browser only ever
receives the records its user may see.
"""
import json
import re
import time
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

try:
    from backend import store
    from backend.auth import get_current_user, is_admin, role_rank
    from backend.broadcasts import DELETED_PAID, forget_paid_client
    from backend import sale_review
except ImportError:
    import store
    from auth import get_current_user, is_admin, role_rank
    from broadcasts import DELETED_PAID, forget_paid_client
    import sale_review


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
    on_write: Optional[Callable[[Optional[dict], dict], None]] = None  # (old, new) after a saved change, same transaction


# Exact values the CRM screens use when a sale is submitted, and when one is sent back.
# Old Client sales skip the Super Admin queue: they wait for the Telegram review link (old_client_review.py).
NEW_SALE_STATUSES = {"Pending Super Admin Review", "Pending Super Admin Approval", sale_review.AWAITING_STATUS,
                     "Old Client - Awaiting Approval"}
NEW_SALE_STAGES = {None, "", "Under Review by Super Admin", "Sale Submitted", sale_review.AWAITING_STAGE,
                   "Awaiting Telegram Approval (Old Client)"}
OPEN_SALE_STATUSES = NEW_SALE_STATUSES | {"Rejected by Super Admin", "Rejected", sale_review.REJECTED_STATUS,
                                          "Old Client - Declined"}


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
        if new.get("status") not in NEW_SALE_STATUSES or new.get("stage") not in NEW_SALE_STAGES:
            return "New sales must start as pending Super Admin review."
        # While the Telegram review group is on, it decides what reaches the Super Admin queue
        if sale_review.enabled() and new.get("status") != sale_review.AWAITING_STATUS:
            return "New sales must first be approved in the Telegram review group."
        return None
    if not _open_sale(old):
        return "This sale is under review or approved; only a Super Admin can change it."
    if new.get("status") != old.get("status") or new.get("stage") != old.get("stage"):
        return "Only a Super Admin can move a sale through review and approval."
    return None


# Company Logo: an image stored as a data URL (the browser shrinks it first). It syncs to every user,
# so it is capped; SVG is accepted because the logo is only ever shown through <img>, where scripts never run.
LOGO_TYPES = ("png", "jpeg", "jpg", "webp", "gif", "svg+xml", "bmp", "x-icon", "vnd.microsoft.icon", "avif")
LOGO_DATA_URL = re.compile(r"^data:image/(" + "|".join(re.escape(t) for t in LOGO_TYPES) + r");base64,[A-Za-z0-9+/]+=*$")
MAX_LOGO_CHARS = 1_400_000   # about 1 MB of image
NATURE_OF_BUSINESS_MAX = 150
# Must match INDIAN_STATES in src/components/ClientInformationModal.jsx (the company State is printed on invoices)
INDIAN_STATES = {
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
    "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi (NCT)", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
}


def _company_profile_check(user: dict, old: Optional[dict], new: Optional[dict]) -> Optional[str]:
    if new is not None and new.get("id") == "companyLogo":
        value = new.get("value") or ""
        if not isinstance(value, str) or (value and not LOGO_DATA_URL.match(value)):
            return "Company Logo must be a JPG, PNG, WEBP, SVG, GIF, BMP, ICO or AVIF image."
        if len(value) > MAX_LOGO_CHARS:
            return "Company Logo is too large (1 MB at most)."
        return None
    if new is not None and new.get("id") == "state":
        if new.get("value") not in INDIAN_STATES and new.get("value") != "":
            return "State must be one of the Indian States or Union Territories in the list."
        return None
    if new is not None and new.get("id") == "natureOfBusiness":
        if not isinstance(new.get("value"), str) or len(new["value"]) > NATURE_OF_BUSINESS_MAX:
            return f"Nature of Business must be text of at most {NATURE_OF_BUSINESS_MAX} characters."
        return None
    # Bank account links are rendered as clickable links for every user, so only web links are accepted
    if new is None or new.get("id") != "bankAccounts":
        return None
    accounts = new.get("value")
    if not isinstance(accounts, list) or not all(isinstance(a, dict) for a in accounts):
        return "Bank accounts must be a list of accounts."
    for account in accounts:
        link = str(account.get("paymentGatewayLink") or "").strip().lower()
        if link and not link.startswith(("https://", "http://")):
            return "Payment Gateway Link must start with https://"
    return None


# Branch ID (branchCode): letters, digits, "-" or "_", unique across branches (ignoring case)
BRANCH_CODE = re.compile(r"^[A-Z0-9][A-Z0-9_-]{0,19}$")


def _branch_check(user: dict, old: Optional[dict], new: Optional[dict]) -> Optional[str]:
    if new is None:
        return None
    code = str(new.get("branchCode") or "").strip().upper()
    if not code:
        return None   # branches saved before Branch ID existed
    if not BRANCH_CODE.match(code):
        return "Branch ID must be 1-20 letters, digits, - or _ (e.g. BR-001)."
    for other in store.all("branches"):
        if other.get("id") != new.get("id") and str(other.get("branchCode") or "").strip().upper() == code:
            return f'Branch ID "{code}" is already used by {other.get("name") or "another branch"}.'
    new["branchCode"] = code
    return None


SERVICE_NAME_MAX = 60
SERVICE_VALUE_MAX = 100_000_000


def _service_check(user: dict, old: Optional[dict], new: Optional[dict]) -> Optional[str]:
    """Service Master: the only Service Names on the Client Information Page, each with a Value (price)."""
    if new is None:
        return None
    name = str(new.get("name") or "").strip()
    if not name or len(name) > SERVICE_NAME_MAX:
        return f"Service Name is required (at most {SERVICE_NAME_MAX} characters)."
    for other in store.all("services"):
        if other.get("id") != new.get("id") and str(other.get("name") or "").strip().lower() == name.lower():
            return f'A service named "{name}" already exists.'
    value = new.get("value")
    if value not in (None, ""):
        if isinstance(value, bool):
            return "Value must be a number."
        try:
            number = float(value)
        except (TypeError, ValueError):
            return "Value must be a number."
        if not (0 <= number <= SERVICE_VALUE_MAX):
            return "Value must be between 0 and 10,00,00,000."
    new["name"] = name
    return None


# Records for Research Recommendations: one row per recommendation, the columns of the regulator's sheet
RR_TEXT_FIELDS = {"nature": 200, "product": 200, "strikePrice": 60, "period": 100}
RR_CALL_PUT_HOLD = {"Call", "Put", "Hold"}
RR_YES_NO = {"Yes", "No"}
RR_RATE_MAX = 100_000_000


def _research_recommendation_check(user: dict, old: Optional[dict], new: Optional[dict]) -> Optional[str]:
    """Records for Research Recommendations: checks every column before it is stored."""
    if new is None:
        return None
    sr_no = new.get("srNo")
    if sr_no in (None, ""):
        new["srNo"] = ""
    else:
        text = str(sr_no).strip()
        if isinstance(sr_no, bool) or not text.isdigit() or not (1 <= int(text) <= 999_999):
            return "Sr. No must be a whole number from 1."
        new["srNo"] = int(text)
    if not _is_date_key(new.get("date")):
        return "Date is required (YYYY-MM-DD)."
    for field, limit in RR_TEXT_FIELDS.items():
        value = str(new.get(field) or "").strip()
        if len(value) > limit:
            return f"{field} can be at most {limit} characters."
        new[field] = value
    if not new["product"]:
        return "Products/ Securities is required."
    if str(new.get("callPutHold") or "") not in RR_CALL_PUT_HOLD | {""}:
        return "Call/Put/ Hold must be Call, Put or Hold."
    if str(new.get("rationaleMaintained") or "") not in RR_YES_NO | {""}:
        return "Rationale maintained must be Yes or No."
    for field, label in (("buyRate", "Buy Rate"), ("sellRate", "Sell Rate")):
        value = new.get(field)
        if value in (None, ""):
            new[field] = ""
            continue
        if isinstance(value, bool):
            return f"{label} must be a number."
        try:
            number = float(value)
        except (TypeError, ValueError):
            return f"{label} must be a number."
        if not (0 <= number <= RR_RATE_MAX):
            return f"{label} must be between 0 and 10,00,00,000."
    return None


MAX_COMPANY_ASSETS = 10


def _company_asset_check(user: dict, old: Optional[dict], new: Optional[dict]) -> Optional[str]:
    # The Add User form offers at most 10 asset items (laptop, SIM card, ID card, ...)
    if new is None:
        return None
    if not str(new.get("name") or "").strip():
        return "Asset name is required."
    if old is None and store.count("companyAssets") >= MAX_COMPANY_ASSETS:
        return f"Only {MAX_COMPANY_ASSETS} company asset items can be set up."
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


def _is_date_key(value) -> bool:
    try:
        return isinstance(value, str) and len(value) == 10 and bool(time.strptime(value, "%Y-%m-%d"))
    except ValueError:
        return False


def _call_stats_check(user: dict, old: Optional[dict], new: Optional[dict]) -> Optional[str]:
    """Team Performance Tracking: one call counter per user per day ({userId}:{YYYY-MM-DD}), kept by
    that user's own browser each time they save a call outcome. Only admins change or remove another's."""
    if not is_admin(user):
        if new is None:
            return "Call counts cannot be deleted."
        if any(doc is not None and doc.get("userId") != user["id"] for doc in (old, new)):
            return "Calls are counted only for yourself."
    if new is None:
        return None
    if not _is_date_key(new.get("date")) or new.get("id") != f"{new.get('userId')}:{new.get('date')}":
        return "A call count needs a user, a YYYY-MM-DD date and the id {userId}:{date}."
    counts = new.get("byDisposition") or {}
    values = [new.get("total"), *counts.values()] if isinstance(counts, dict) else [None]
    if not all(isinstance(v, int) and not isinstance(v, bool) and v >= 0 for v in values):
        return "Call counts must be whole numbers."
    return None


ATTENDANCE_STATUSES = {"Present", "Absent", "Half Day", "Leave"}


def _attendance_check(user: dict, old: Optional[dict], new: Optional[dict]) -> Optional[str]:
    """Attendance is marked by someone the person reports to (directly or higher up): the scoped
    write already limits it to the marker's team, and only a Super Admin may mark their own."""
    for doc in (old, new):
        if doc is not None and doc.get("userId") == user["id"] and user["role"] != "Super Admin":
            return "Your attendance is marked by the person you report to."
    if new is None:
        return None
    if not _is_date_key(new.get("date")) or new.get("id") != f"{new.get('userId')}:{new.get('date')}":
        return "Attendance needs a user, a YYYY-MM-DD date and the id {userId}:{date}."
    if new.get("status") not in ATTENDANCE_STATUSES:
        return f"Attendance must be one of: {', '.join(sorted(ATTENDANCE_STATUSES))}."
    # Recorded as whoever saved it, whatever the browser sent
    new["markedById"], new["markedByName"] = user["id"], user.get("name") or ""
    return None


# Login Disclaimer pop-up (System Settings): shown to every user right after they sign in
LOGIN_DISCLAIMER_FIELDS = {"enabled": bool, "title": str, "message": str}
LOGIN_DISCLAIMER_MAX_CHARS = {"title": 150, "message": 10000}


def _login_disclaimer_check(user: dict, old: Optional[dict], new: Optional[dict]) -> Optional[str]:
    if new is None:
        return None
    key, value = new.get("id"), new.get("value")
    if key not in LOGIN_DISCLAIMER_FIELDS:
        return f"Unknown Login Disclaimer setting '{key}'."
    if not isinstance(value, LOGIN_DISCLAIMER_FIELDS[key]):
        return f"Login Disclaimer '{key}' has the wrong type."
    limit = LOGIN_DISCLAIMER_MAX_CHARS.get(key)
    if limit and len(value) > limit:
        return f"Login Disclaimer {key} can be at most {limit} characters."
    if key == "message" and not value.strip():
        return "The Login Disclaimer message cannot be empty."
    return None


POLICIES: Dict[str, Policy] = {
    "leads": Policy(read=SCOPED, write=SCOPED, owner=_lead_owner, delete_min_rank=role_rank("Team Leader")),
    "sales": Policy(read=SCOPED, write=SCOPED, check=_sale_check, on_write=sale_review.on_sale_write,
                    owner=lambda s: s.get("submittedByUserId") or s.get("employeeId")),
    "assignmentInstances": Policy(read=SCOPED, write=SCOPED, delete_min_rank=role_rank("Team Leader"),
                                  owner=lambda i: i.get("assignedToId") or i.get("assigned_user_id")),
    "leadRequests": Policy(read=SCOPED, write=SCOPED, owner=lambda r: r.get("requestedByUserId")),
    "notifications": Policy(read=EVERYONE, write=EVERYONE, visible=_notification_visible, check=_notification_check),
    "userShortcutSettings": Policy(read=SCOPED, write=SCOPED, owner=lambda s: s.get("userId")),
    "masterRecords": Policy(read=ADMIN, write=ADMIN),
    "eSignRecords": Policy(read=ADMIN, write=ADMIN),
    # Executives, Team Leaders and Managers read the Paid clients of their own team's sales
    "paidClients": Policy(read=SCOPED, write=ADMIN, check=_paid_check, on_delete=forget_paid_client,
                          owner=lambda p: p.get("submittedByUserId")),
    # Team Performance Tracking block
    "callStats": Policy(read=SCOPED, write=SCOPED, owner=lambda c: c.get("userId"), check=_call_stats_check),
    "attendance": Policy(read=SCOPED, write=SCOPED, owner=lambda a: a.get("userId"), check=_attendance_check),
    "services": Policy(read=EVERYONE, write=SUPER_ADMIN, check=_service_check),
    "userCustomFields": Policy(read=EVERYONE, write=SUPER_ADMIN),
    # Key/value collections: one record {"id": key, "value": ...} per top-level key
    "userPermissions": Policy(read=EVERYONE, write=SUPER_ADMIN, visible=_own_entry),
    "financialSettings": Policy(read=EVERYONE, write=SUPER_ADMIN, redact=_redact_passwords),
    "voiceAgentSettings": Policy(read=EVERYONE, write=SUPER_ADMIN),
    "companyProfile": Policy(read=EVERYONE, write=SUPER_ADMIN, check=_company_profile_check),
    "loginDisclaimer": Policy(read=EVERYONE, write=SUPER_ADMIN, check=_login_disclaimer_check),
    # Branch Profiles block; every user creator picks from these names
    "branches": Policy(read=EVERYONE, write=SUPER_ADMIN, check=_branch_check),
    # "Company Assets Provided" items offered in Add User (max 10)
    "companyAssets": Policy(read=EVERYONE, write=SUPER_ADMIN, check=_company_asset_check),
    # Records for Research Recommendations block (Admins and the Super Admin keep it)
    "researchRecommendations": Policy(read=ADMIN, write=ADMIN, check=_research_recommendation_check),
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


def _epoch() -> str:
    """JSON of the data epoch, set when the data is reset (backend/reset_data.py); null before any reset.
    A browser that sees a new epoch drops its cached copy instead of uploading it to the emptied server."""
    return json.dumps(store.get_value("dataEpoch"))


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
        body = f'{{"full": true, "cursor": {int(cursor)}, "epoch": {_epoch()}, "collections": {{{", ".join(parts)}}}}}'
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
    body = f'{{"full": false, "cursor": {int(feed["cursor"])}, "epoch": {_epoch()}, "collections": {{{", ".join(parts)}}}}}'
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
                    if policy.on_write:
                        policy.on_write(old, doc)
                saved[name].append(rid)
            store.put_pairs(name, list(writes.items()))
            plain_deletes = []
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
                    plain_deletes.append(rid)
                saved[name].append(rid)
            store.delete_many(name, plain_deletes)
    return {"saved": saved, "rejected": rejected, "cursor": store.cursor()}


# ==========================================
# PAN duplicate check (Client Information form)
# ==========================================
PAN_PATTERN = re.compile(r"[A-Z]{5}[0-9]{4}[A-Z]")
# Where a PAN may already be on file, and how the form names that place
PAN_SOURCES = (("paidClients", "an existing paid client"), ("eSignRecords", "an e-signed client"),
               ("sales", "a submitted sale"), ("leads", "another lead's client information"))


def _pans_of(doc: dict) -> set:
    found = {doc.get("panNumber")}
    for key in ("clientInfo", "fullClientInfo"):
        if isinstance(doc.get(key), dict):
            found.add(doc[key].get("panNumber"))
    return {str(p).replace(" ", "").upper() for p in found if p}


def _counts_as_on_file(collection: str, doc: dict) -> bool:
    # A sale turned down in review never made the PAN a client's
    if collection == "sales":
        status = f"{doc.get('status') or ''} {doc.get('stage') or ''}".lower()
        return "reject" not in status and "declin" not in status
    return True


@router.get("/pan-check")
def pan_check(pan: str = Query(..., max_length=20), leadId: str = Query("", max_length=200),
              current_user: dict = Depends(get_current_user)):
    """Whether a PAN is already on file anywhere in the CRM, whoever's team holds it. Answers only
    yes/no and the kind of record, never the other client's details. Records of `leadId` itself
    (this client's own earlier submission) do not count."""
    pan = pan.replace(" ", "").upper()
    if not PAN_PATTERN.fullmatch(pan):
        raise HTTPException(status_code=400, detail="Enter a valid 10-character PAN (e.g. ABCDE1234F).")
    for collection, label in PAN_SOURCES:
        for doc in store.containing(collection, pan):
            own = doc.get("id") if collection == "leads" else doc.get("leadId")
            if leadId and own == leadId:
                continue
            if pan in _pans_of(doc) and _counts_as_on_file(collection, doc):
                return {"exists": True, "source": label}
    return {"exists": False}
