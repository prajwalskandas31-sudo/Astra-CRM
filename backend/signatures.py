"""Digital Signature Storage Block: one shared, server-side copy of the signatory signatures.

Browsers keep a local cache, but this file is the source of truth, so every Super Admin/Admin
browser sees the same signature and Leegality dispatch never depends on which browser uploaded it.
"""
import json
import os
import re
import threading
from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

try:
    from backend.auth import (require_roles, verify_password, is_admin, check_not_locked,
                              record_failure, clear_failures, ADMIN_ROLES)
    from backend.database import USERS_DB
except ImportError:
    from auth import (require_roles, verify_password, is_admin, check_not_locked,
                      record_failure, clear_failures, ADMIN_ROLES)
    from database import USERS_DB


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
SIGNATURES_PATH = os.path.join(BACKEND_DIR, "data", "signatures.json")
MAX_SIGNATURES = 25
MAX_IMAGE_CHARS = 3_000_000  # ~2.2 MB image as a data URL
KEY_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

router = APIRouter(prefix="/api/signatures", tags=["signatures"])
_lock = threading.Lock()


def read_signatures() -> dict:
    if not os.path.exists(SIGNATURES_PATH):
        return {}
    with open(SIGNATURES_PATH, encoding="utf-8") as f:
        return json.load(f)


def stored_primary_signature() -> Optional[str]:
    """Image of the master officer (Primary Signatory), used when dispatching agreements."""
    return (read_signatures().get("master_officer") or {}).get("signatureDataUrl") or None


class SignatureSave(BaseModel):
    signatures: Dict[str, dict]
    password: str


@router.get("")
def get_signatures(current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    return read_signatures()


@router.put("")
def save_signatures(req: SignatureSave, current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    # Changing a signature needs a password, not just a session: the caller's own or an active admin's
    key = f"signature-save:{current_user['id']}"
    check_not_locked(key)
    admins = [u for u in USERS_DB if is_admin(u) and u.get("status") == "Active"]
    if not any(verify_password(req.password, u.get("passwordHash")) for u in [current_user] + admins):
        record_failure(key)
        raise HTTPException(status_code=401, detail="Incorrect password. Re-enter your password to save signatures.")
    clear_failures(key)

    if len(req.signatures) > MAX_SIGNATURES:
        raise HTTPException(status_code=400, detail=f"At most {MAX_SIGNATURES} signatures can be stored.")
    for name, record in req.signatures.items():
        if not KEY_PATTERN.match(name):
            raise HTTPException(status_code=400, detail=f"Invalid signature key '{name}'.")
        image = record.get("signatureDataUrl") or ""
        if len(image) > MAX_IMAGE_CHARS:
            raise HTTPException(status_code=400, detail=f"Signature '{name}' is too large (max ~2 MB).")
        if image and not re.match(r"^data:image/(png|jpe?g|webp|svg\+xml);base64,", image):
            raise HTTPException(status_code=400, detail=f"Signature '{name}' must be a PNG, JPG, WEBP or SVG image.")

    stamped = {
        name: {**record, "serverSavedAt": datetime.now(timezone.utc).isoformat(), "serverSavedBy": current_user["name"]}
        for name, record in req.signatures.items()
    }
    with _lock:
        os.makedirs(os.path.dirname(SIGNATURES_PATH), exist_ok=True)
        tmp = SIGNATURES_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(stamped, f)
        os.replace(tmp, SIGNATURES_PATH)
    return stamped
