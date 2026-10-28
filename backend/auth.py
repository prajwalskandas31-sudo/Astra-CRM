import hashlib
import hmac
import json
import os
import secrets
import threading
import time
import jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, Security, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
try:
    from backend.database import USERS_DB
except ImportError:
    from database import USERS_DB


# Without a configured secret, a random one is generated per process (tokens then reset on restart).
SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or secrets.token_urlsafe(48)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 600

# Higher rank = more authority. Unknown/custom roles get the lowest rank.
ROLE_RANK = {"Super Admin": 5, "Admin": 4, "Manager": 3, "Team Leader": 2, "Team Lead": 2, "Executive": 1}
ADMIN_ROLES = ["Super Admin", "Admin"]

# Fields never sent to non-admin users; password hashes are never sent to anyone.
SENSITIVE_USER_FIELDS = {"bankAccountNumber", "ifscCode", "bankNameAndBranch", "familyReferenceNumber", "documents"}
SECRET_USER_FIELDS = {"password", "passwordHash", "tokenVersion"}

security = HTTPBearer()


def role_rank(role: Optional[str]) -> int:
    return ROLE_RANK.get(role or "", 0)


def is_admin(user: dict) -> bool:
    return user.get("role") in ADMIN_ROLES


# ==========================================
# Password hashing (PBKDF2-SHA256)
# ==========================================
_PBKDF2_ITERATIONS = 240_000
_COMMON_PASSWORDS = {"123456", "12345678", "password", "password123", "admin123", "superadmin123",
                     "manager123", "tl123", "executive123", "qwerty123", "letmein123"}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: Optional[str]) -> bool:
    if not stored or not password:
        # Burn comparable time so unknown accounts are not distinguishable by timing.
        hashlib.pbkdf2_hmac("sha256", (password or "x").encode(), b"0" * 16, _PBKDF2_ITERATIONS)
        return False
    try:
        _, iterations, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
        return hmac.compare_digest(digest.hex(), digest_hex)
    except ValueError:
        return False


def validate_password_strength(password: Optional[str]) -> str:
    if not password or len(password) < 10:
        raise HTTPException(status_code=400, detail="Password must be at least 10 characters long.")
    if password.lower() in _COMMON_PASSWORDS:
        raise HTTPException(status_code=400, detail="Password is too common. Choose a stronger password.")
    return password


def set_user_password(user: dict, password: str) -> None:
    user["passwordHash"] = hash_password(password)
    user.pop("password", None)
    # Invalidates every token issued before the change.
    user["tokenVersion"] = user.get("tokenVersion", 0) + 1


def load_credentials() -> None:
    """Replace seed passwords with hashes from the credentials file; accounts not listed there cannot log in."""
    path = os.environ.get("CRM_CREDENTIALS_FILE", "")
    creds = {}
    if path and os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for entry in json.load(f):
                creds[entry["email"].strip().lower()] = entry["password"]

    for user in USERS_DB:
        plain = creds.get((user.get("email") or "").lower())
        if plain is None and not path:
            plain = user.get("password")  # Local development without a credentials file keeps seed passwords.
        user.pop("password", None)
        user["passwordHash"] = hash_password(plain) if plain else None
        user.setdefault("tokenVersion", 0)


# ==========================================
# Brute-force protection
# ==========================================
_MAX_FAILURES = 5
_LOCKOUT_SECONDS = 15 * 60
_failures: dict[str, list[float]] = {}
_failures_lock = threading.Lock()


def check_not_locked(*keys: str) -> None:
    now = time.time()
    with _failures_lock:
        for key in keys:
            recent = [t for t in _failures.get(key, []) if now - t < _LOCKOUT_SECONDS]
            _failures[key] = recent
            if len(recent) >= _MAX_FAILURES:
                raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")


def record_failure(*keys: str) -> None:
    now = time.time()
    with _failures_lock:
        for key in keys:
            _failures.setdefault(key, []).append(now)


def clear_failures(*keys: str) -> None:
    with _failures_lock:
        for key in keys:
            _failures.pop(key, None)


# ==========================================
# Tokens & user views
# ==========================================
def create_access_token(user: dict, expires_delta: Optional[timedelta] = None):
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode = {"sub": user["id"], "ver": user.get("tokenVersion", 0), "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def public_user(user: dict, viewer: Optional[dict] = None) -> dict:
    """Strip secrets always, and personal/financial fields unless the viewer is an admin or the user themself."""
    hidden = set(SECRET_USER_FIELDS)
    if viewer is not None and not is_admin(viewer) and viewer.get("id") != user.get("id"):
        hidden |= SENSITIVE_USER_FIELDS
    return {k: v for k, v in user.items() if k not in hidden}


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"require": ["exp", "sub"]})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token")

    user = next((u for u in USERS_DB if u["id"] == payload.get("sub")), None)
    if user is None or payload.get("ver") != user.get("tokenVersion", 0):
        raise HTTPException(status_code=401, detail="Session is no longer valid. Please sign in again.")
    if user.get("status") != "Active":
        raise HTTPException(status_code=403, detail="Account is disabled/inactive. Contact Super Admin.")
    return user


def require_roles(allowed_roles: list[str]):
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: Action restricted to roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker
