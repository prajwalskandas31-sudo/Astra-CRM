"""Generate a fresh random password for every seed account.

Writes (both git-ignored):
  secrets/credentials.json       -> mounted read-only into the backend container
  CRM_ACCOUNT_CREDENTIALS.txt    -> human-readable sheet to hand out to staff

Run from the project root:  python deploy/generate_credentials.py
Re-running rotates every password; redeploy afterwards for it to take effect.
"""
import json
import os
import secrets
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.database import USERS_DB  # noqa: E402

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"


def new_password() -> str:
    return "-".join("".join(secrets.choice(ALPHABET) for _ in range(4)) for _ in range(3))


def open_private(path):
    """Open for writing with owner-only permissions (0600), tightening any existing file first."""
    if os.path.exists(path):
        os.chmod(path, 0o600)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    return os.fdopen(fd, "w", encoding="utf-8")


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    entries = [{"email": u["email"], "password": new_password()} for u in USERS_DB]
    by_email = {e["email"]: e["password"] for e in entries}

    secrets_dir = os.path.join(root, "secrets")
    os.makedirs(secrets_dir, mode=0o700, exist_ok=True)
    os.chmod(secrets_dir, 0o700)
    with open_private(os.path.join(secrets_dir, "credentials.json")) as f:
        json.dump(entries, f, indent=2)

    lines = [
        "SRINIVAS CRM - ACCOUNT CREDENTIALS",
        f"Generated: {date.today().isoformat()}",
        "Sign in with the email OR employee ID OR 10-digit mobile number, plus the password.",
        "Keep this file private. Re-running deploy/generate_credentials.py rotates every password.",
        "",
    ]
    for role in ["Super Admin", "Admin", "Manager", "Team Leader", "Executive"]:
        users = [u for u in USERS_DB if u["role"] == role]
        if not users:
            continue
        lines.append(f"== {role} ==")
        for u in users:
            lines.append(f"  {u['name']}")
            lines.append(f"    Email       : {u['email']}")
            lines.append(f"    Employee ID : {u['employeeId']}")
            lines.append(f"    Mobile      : {u['mobile']}")
            lines.append(f"    Password    : {by_email[u['email']]}")
        lines.append("")
    with open_private(os.path.join(root, "CRM_ACCOUNT_CREDENTIALS.txt")) as f:
        f.write("\n".join(lines))

    print(f"Generated credentials for {len(entries)} accounts.")


if __name__ == "__main__":
    main()
