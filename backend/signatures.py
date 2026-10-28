"""Digital Signature Storage Block: one shared, server-side copy of the signatory signatures.

Browsers keep a local cache, but this file is the source of truth, so every Super Admin/Admin
browser sees the same signature and Leegality dispatch never depends on which browser uploaded it.
"""
import base64
import io
import json
import os
import re
import threading
from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from PIL import Image
from pydantic import BaseModel

try:
    from backend.auth import require_roles, verify_password, check_not_locked, record_failure, clear_failures, ADMIN_ROLES
except ImportError:
    from auth import require_roles, verify_password, check_not_locked, record_failure, clear_failures, ADMIN_ROLES


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
SIGNATURES_PATH = os.path.join(BACKEND_DIR, "data", "signatures.json")
MAX_SIGNATURES = 25
MAX_IMAGE_CHARS = 3_000_000  # ~2.2 MB image as a data URL
KEY_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
PRIMARY_KEY = "master_officer"

router = APIRouter(prefix="/api/signatures", tags=["signatures"])
_lock = threading.Lock()


def read_signatures() -> dict:
    if not os.path.exists(SIGNATURES_PATH):
        return {}
    with open(SIGNATURES_PATH, encoding="utf-8") as f:
        return json.load(f)


def stored_primary_signature() -> Optional[str]:
    """Image of the master officer (Primary Signatory), used when dispatching agreements."""
    return (read_signatures().get(PRIMARY_KEY) or {}).get("signatureDataUrl") or None


class SignatureSave(BaseModel):
    signatures: Dict[str, dict]
    password: str


@router.get("")
def get_signatures(current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    return read_signatures()


def _content(record: Optional[dict]) -> dict:
    """A signature record without the server's bookkeeping fields, for change detection."""
    return {k: v for k, v in (record or {}).items() if not k.startswith("serverSaved")}


def _validate_image(name: str, image: str) -> None:
    if len(image) > MAX_IMAGE_CHARS:
        raise HTTPException(status_code=400, detail=f"Signature '{name}' is too large (max ~2 MB).")
    match = re.match(r"^data:image/(png|jpe?g|webp);base64,(.+)$", image, re.S)
    if not match:
        raise HTTPException(status_code=400, detail=f"Signature '{name}' must be a PNG, JPG or WEBP image.")
    try:
        with Image.open(io.BytesIO(base64.b64decode(match.group(2), validate=True))) as img:
            img.verify()
    except Exception:
        raise HTTPException(status_code=400, detail=f"Signature '{name}' is not a readable image.")


@router.put("")
def save_signatures(req: SignatureSave, current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    # A session alone is not enough: the caller re-enters their own password. Failures share the
    # login lockout counter, so this cannot be used to guess passwords faster than the login page.
    key = f"acct:{current_user['id']}"
    check_not_locked(key)
    if not verify_password(req.password, current_user.get("passwordHash")):
        record_failure(key)
        raise HTTPException(status_code=401, detail="Incorrect password. Re-enter your password to save signatures.")
    clear_failures(key)

    if len(req.signatures) > MAX_SIGNATURES:
        raise HTTPException(status_code=400, detail=f"At most {MAX_SIGNATURES} signatures can be stored.")

    stored = read_signatures()
    # The Primary Signatory signs every Leegality agreement, so only a Super Admin may change it
    if current_user["role"] != "Super Admin" and _content(req.signatures.get(PRIMARY_KEY)) != _content(stored.get(PRIMARY_KEY)):
        raise HTTPException(status_code=403, detail="Only a Super Admin can change the Primary Signatory signature.")

    now = datetime.now(timezone.utc).isoformat()
    stamped = {}
    for name, record in req.signatures.items():
        if not KEY_PATTERN.match(name):
            raise HTTPException(status_code=400, detail=f"Invalid signature key '{name}'.")
        if _content(record) == _content(stored.get(name)):
            stamped[name] = stored[name]  # unchanged: keep who saved it and when
            continue
        if record.get("signatureDataUrl"):
            _validate_image(name, record["signatureDataUrl"])
        stamped[name] = {**record, "serverSavedAt": now, "serverSavedBy": current_user["name"]}
    if current_user["role"] != "Super Admin" and PRIMARY_KEY in stored and PRIMARY_KEY not in stamped:
        stamped[PRIMARY_KEY] = stored[PRIMARY_KEY]
    with _lock:
        os.makedirs(os.path.dirname(SIGNATURES_PATH), exist_ok=True)
        tmp = SIGNATURES_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(stamped, f)
        os.replace(tmp, SIGNATURES_PATH)
    return stamped
