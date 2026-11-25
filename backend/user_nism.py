"""User Directory -> Add / Edit User -> NISM Exam Details.

The six details (Name, Series, Registration Number, Enrollment Number, Exam Cleared Date, Valid Upto) are kept on
the user record as "nism" (set through POST / PUT /api/users, cleaned by clean_details). Up to 10 documents per
user are kept apart from the user record, so the user list that syncs to every browser stays small:
  userNismDocs      metadata {id, userId, fileName, contentType, size, uploadedAt, uploadedBy}
  userNismDocFiles  contents {id, data (base64)}

Who may upload / delete: the Super Admin for anyone, an Admin for users ranked below Admin (as for the rest of the
user's profile). Who may list / download: the same, plus the user themselves.
"""
import base64
import re
import secrets
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

try:
    from backend import store
    from backend.auth import get_current_user, role_rank
except ImportError:
    import store
    from auth import get_current_user, role_rank

DOCS = "userNismDocs"
DOC_FILES = "userNismDocFiles"
MAX_DOCS = 10
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_NAME_CHARS = 150
MAX_TEXT = 120
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DOC_ID_RE = re.compile(r"^nism-[0-9a-f]{24}$")
TEXT_FIELDS = ("name", "series", "registrationNumber", "enrollmentNumber")
DATE_FIELDS = ("clearedDate", "validUpto")
FIELD_LABELS = {"clearedDate": "Exam Cleared Date", "validUpto": "Valid Upto"}

router = APIRouter(prefix="/api/users", tags=["user-nism"])


# ==========================================
# Details on the user record
# ==========================================
def clean_details(raw) -> dict:
    """{"name", "series", "registrationNumber", "enrollmentNumber", "clearedDate", "validUpto"} as text; dates YYYY-MM-DD."""
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise HTTPException(status_code=400, detail="NISM Exam Details must be a set of values.")
    out = {}
    for key in TEXT_FIELDS:
        out[key] = " ".join(str(raw.get(key) or "").split())[:MAX_TEXT]
    for key in DATE_FIELDS:
        value = str(raw.get(key) or "").strip()
        if value and not DATE_RE.fullmatch(value):
            raise HTTPException(status_code=400, detail=f"NISM {FIELD_LABELS[key]} must be a date (YYYY-MM-DD).")
        out[key] = value
    if out["clearedDate"] and out["validUpto"] and out["validUpto"] < out["clearedDate"]:
        raise HTTPException(status_code=400, detail="NISM Valid Upto cannot be before the Exam Cleared Date.")
    return out


# ==========================================
# Access
# ==========================================
def _target(user_id: str) -> dict:
    user = store.get("users", user_id) if re.fullmatch(r"[A-Za-z0-9_.-]{1,80}", user_id or "") else None
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


def _can_manage(viewer: dict, target: dict) -> bool:
    if viewer.get("role") == "Super Admin":
        return True
    return viewer.get("role") == "Admin" and role_rank(target.get("role")) < role_rank("Admin")


def _check(viewer: dict, target: dict, write: bool) -> None:
    if _can_manage(viewer, target) or (not write and viewer.get("id") == target.get("id")):
        return
    # Someone who may not see the user gets the same answer as for a missing one
    raise HTTPException(status_code=404 if not write else 403,
                        detail="User not found." if not write else "Only a Super Admin, or an Admin for their staff, can change NISM documents.")


# ==========================================
# Documents
# ==========================================
class NismDocUpload(BaseModel):
    fileName: str
    contentType: Optional[str] = ""
    dataBase64: str


def _safe_name(name: str) -> str:
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", " ".join(str(name or "").split())).strip(" .")
    return name[:MAX_NAME_CHARS]


def _attachment(name: str) -> dict:
    ascii_name = name.encode("ascii", "replace").decode("ascii").replace("?", "_")
    return {"Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}"}


def _docs_of(user_id: str) -> list:
    docs = [d for d in store.all(DOCS) if d.get("userId") == user_id]
    return sorted(docs, key=lambda d: d.get("uploadedAt") or "")


def _doc_or_404(user_id: str, doc_id: str) -> dict:
    doc = store.get(DOCS, doc_id) if DOC_ID_RE.fullmatch(doc_id or "") else None
    if not doc or doc.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


@router.get("/{user_id}/nism-documents")
def list_docs(user_id: str, current_user: dict = Depends(get_current_user)):
    target = _target(user_id)
    _check(current_user, target, write=False)
    return {"documents": _docs_of(user_id), "max": MAX_DOCS, "maxFileBytes": MAX_FILE_BYTES,
            "canManage": _can_manage(current_user, target)}


@router.post("/{user_id}/nism-documents")
def upload_doc(user_id: str, req: NismDocUpload, current_user: dict = Depends(get_current_user)):
    target = _target(user_id)
    _check(current_user, target, write=True)
    name = _safe_name(req.fileName)
    if not name:
        raise HTTPException(status_code=400, detail="The file needs a name.")
    raw = (req.dataBase64 or "").strip()
    limit_mb = MAX_FILE_BYTES // (1024 * 1024)
    if len(raw) > (MAX_FILE_BYTES * 4) // 3 + 8:
        raise HTTPException(status_code=413, detail=f"Each file can be at most {limit_mb} MB.")
    try:
        content = base64.b64decode(raw, validate=True)
    except ValueError:
        raise HTTPException(status_code=400, detail="The file could not be read (invalid base64).")
    if not content:
        raise HTTPException(status_code=400, detail="The file is empty.")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"Each file can be at most {limit_mb} MB.")

    doc_id = f"nism-{secrets.token_hex(12)}"
    meta = {"id": doc_id, "userId": user_id, "fileName": name, "contentType": (req.contentType or "")[:100],
            "size": len(content), "uploadedAt": datetime.now(timezone.utc).isoformat(),
            "uploadedBy": current_user.get("name") or ""}
    # Counted and written in one transaction, so two uploads at once cannot both be the 11th
    with store.transaction():
        if len(_docs_of(user_id)) >= MAX_DOCS:
            raise HTTPException(status_code=409, detail=f"A user can have at most {MAX_DOCS} NISM documents. Delete one first.")
        store.put(DOC_FILES, doc_id, {"id": doc_id, "data": base64.b64encode(content).decode("ascii")})
        store.put(DOCS, doc_id, meta)
    return meta


@router.get("/{user_id}/nism-documents/{doc_id}/file")
def download_doc(user_id: str, doc_id: str, current_user: dict = Depends(get_current_user)):
    target = _target(user_id)
    _check(current_user, target, write=False)
    doc = _doc_or_404(user_id, doc_id)
    stored = store.get(DOC_FILES, doc_id) or {}
    if not stored.get("data"):
        raise HTTPException(status_code=500, detail=f"The contents of {doc['fileName']} are missing.")
    return Response(content=base64.b64decode(stored["data"]), media_type=doc.get("contentType") or "application/octet-stream",
                    headers=_attachment(doc["fileName"]))


@router.delete("/{user_id}/nism-documents/{doc_id}")
def delete_doc(user_id: str, doc_id: str, current_user: dict = Depends(get_current_user)):
    target = _target(user_id)
    _check(current_user, target, write=True)
    with store.transaction():
        _doc_or_404(user_id, doc_id)
        store.delete(DOC_FILES, doc_id)
        store.delete(DOCS, doc_id)
    return {"deleted": doc_id}
