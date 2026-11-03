"""Create the database tables and fill a brand-new database.

Runs once before the backend workers start (deploy/start_backend.sh) and again, harmlessly, when
each worker imports the app. Seeding happens only while the database has no users, so passwords
changed in the CRM are never reset by a restart. Data that older versions kept in JSON files under
backend/data is imported the first time, then left on disk untouched as a fallback copy.

    python -m backend.db_init                       # create tables, seed an empty database
    python -m backend.db_init --apply-credentials   # also reset passwords from secrets/credentials.json
"""
import copy
import json
import os

try:
    from backend import store
    from backend import database as seed
    from backend.auth import read_credentials_file, seed_password, set_user_password
except ImportError:
    import store
    import database as seed
    from auth import read_credentials_file, seed_password, set_user_password

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BACKEND_DIR, "data")

SEED_COLLECTIONS = {
    "dispositions": seed.DISPOSITIONS_DB,
    "customRoles": seed.CUSTOM_ROLES_DB,
    "documentTypes": seed.DOCUMENT_TYPES_DB,
}

# Older versions kept these in JSON files: list files become collections, dict files single values
LEGACY_LISTS = {"paid_clients.json": "paidClients", "broadcasts.json": "broadcasts"}
LEGACY_VALUES = {"paid_clients_deleted.json": "paidClientsDeleted", "telegram_senders.json": "telegramSenders",
                 "telegram_offsets.json": "telegramOffsets", "signatures.json": "signatures",
                 "leegality_documents.json": "leegalityDocuments"}


def _seed_users() -> None:
    creds = read_credentials_file()
    for user in copy.deepcopy(seed.USERS_DB):
        seed_password(user, creds)
        store.put("users", user["id"], user)


def _import_legacy_files(data_dir: str) -> list:
    """Each file is imported once (a marker records it), so records deleted later never come back."""
    imported = []
    for filename in [*LEGACY_LISTS, *LEGACY_VALUES]:
        path = os.path.join(data_dir, filename)
        marker = f"legacyImported:{filename}"
        if not os.path.exists(path) or store.get_value(marker):
            continue
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if filename in LEGACY_LISTS:
            items = [i for i in data if isinstance(i, dict) and i.get("id")]
            # The broadcast log is newest first; store oldest first so seq order matches time order
            store.put_many(LEGACY_LISTS[filename], reversed(items) if filename == "broadcasts.json" else items)
        else:
            store.set_value(LEGACY_VALUES[filename], data)
        store.set_value(marker, True)
        imported.append(filename)
    return imported


def init_database(data_dir: str = DATA_DIR) -> dict:
    store.backend()  # creates the tables
    with store.transaction():  # serialized, so two workers starting together cannot both seed
        seeded = store.count("users") == 0
        if seeded:
            _seed_users()
            for collection, docs in SEED_COLLECTIONS.items():
                if store.count(collection) == 0:
                    store.put_many(collection, copy.deepcopy(docs))
        imported = _import_legacy_files(data_dir)
    return {"backend": store.backend().name, "seeded": seeded, "imported": imported}


def apply_credentials() -> list:
    """Set the password of every account listed in the credentials file (password rotation).
    Their existing sessions end; accounts not in the file keep their password."""
    creds = read_credentials_file() or {}
    changed = []
    with store.transaction():
        for user in store.all("users"):
            password = creds.get((user.get("email") or "").lower())
            if password:
                set_user_password(user, password)
                store.put("users", user["id"], user)
                changed.append(user["email"])
    return changed


if __name__ == "__main__":
    import sys
    print("Database ready:", init_database())
    if "--apply-credentials" in sys.argv:
        print("Passwords set from the credentials file for:", ", ".join(apply_credentials()) or "nobody")
