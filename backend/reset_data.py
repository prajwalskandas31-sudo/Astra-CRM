"""Start the CRM fresh: delete the business data, keep users and configuration.

Run inside the backend container, after taking a database backup:
    docker compose exec -T backend python -m backend.reset_data --yes

Records become tombstones (not hard-deleted), so CRM tabs that are open receive them as deletes.
A new data epoch is published too: a browser that sees it drops its cached copy instead of
uploading old records to the emptied server (see src/services/serverSync.js).
"""
import argparse
import uuid
from datetime import datetime, timezone

try:
    from backend import store
except ImportError:
    import store

# Business data. Users, roles, services, dispositions, document types, settings, the signatory's
# signature and the Telegram bot setup (verified senders, update offsets) are kept.
BUSINESS_COLLECTIONS = (
    "leads", "sales", "assignmentInstances", "leadRequests", "notifications",
    "masterRecords", "eSignRecords", "paidClients", "broadcasts", "login_failures",
)
# Single values (collection "kv") that hold business data, and their empty value
BUSINESS_VALUES = {"leegalityDocuments": {}, "paidClientsDeleted": []}
EPOCH = "dataEpoch"


def live_counts() -> dict:
    return {name: store.count(name) for name in BUSINESS_COLLECTIONS}


def reset() -> dict:
    deleted = {}
    with store.transaction():
        for name in BUSINESS_COLLECTIONS:
            deleted[name] = len(store.delete_many(name, [doc["id"] for doc in store.all(name)]))
        for name, empty in BUSINESS_VALUES.items():
            if store.get("kv", name) is not None:
                store.set_value(name, empty)
        epoch = f"{datetime.now(timezone.utc):%Y%m%dT%H%M%S}-{uuid.uuid4().hex[:6]}"
        store.set_value(EPOCH, epoch)
    return {"deleted": deleted, "epoch": epoch}


def main() -> None:
    parser = argparse.ArgumentParser(description="Start the CRM fresh: delete the business data, keep users and configuration.")
    parser.add_argument("--yes", action="store_true", help="really delete (otherwise only show what would go)")
    args = parser.parse_args()
    print("Would delete:" if not args.yes else "Deleting:", live_counts())
    if args.yes:
        print(reset())


if __name__ == "__main__":
    main()
