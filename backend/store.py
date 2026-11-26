"""Persistent record store shared by every backend worker.

Every CRM record (users, leads, sales, settings, ...) is one JSON document in the `records` table
(stored as text: full downloads send it to browsers without parsing; for ad-hoc reports in SQL use
`data::jsonb ->> 'field'`),
keyed by (collection, id). Production uses PostgreSQL (DATABASE_URL); local development and the
tests fall back to a SQLite file, so the same code runs everywhere.

Each write gets a new, strictly increasing `seq`, which is what lets browsers ask "what changed
since N" instead of downloading everything. Writes are serialized (a Postgres advisory lock, or
SQLite's write lock) so a reader can never see seq 105 committed before 104 and skip 104 forever.
Deletes leave a tombstone row so incremental readers learn about them too.
"""
import contextlib
import contextvars
import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Callable, Iterable, Optional

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SQLITE_PATH = os.path.join(BACKEND_DIR, "data", "crm.sqlite3")
_WRITE_LOCK_KEY = 7_340_001  # any constant; identifies the CRM's advisory lock in Postgres

# Owner of a record (a user id) per collection, so scoped reads can use an index instead of
# loading every lead. Registered by the modules that define the collections.
_owner_fns: dict[str, Callable[[dict], Optional[str]]] = {}

# Lookup keys of a record per collection (e.g. ("pan", "ABCDE1234F")), kept in `record_keys` so exact
# lookups such as the PAN duplicate check use an index instead of scanning every record's JSON.
# Registered with a version: changing what a function returns needs a new version, which rebuilds the keys.
_key_fns: dict[str, tuple[str, Callable[[dict], Iterable[tuple[str, str]]]]] = {}
_keys_ready: set = set()

_current: contextvars.ContextVar = contextvars.ContextVar("crm_store_tx", default=None)
_init_lock = threading.Lock()
_backend = None


def register_owner(collection: str, fn: Callable[[dict], Optional[str]]) -> None:
    _owner_fns[collection] = fn


def has_owner(collection: str) -> bool:
    return collection in _owner_fns


def owner_of(collection: str, data: Optional[dict]) -> Optional[str]:
    fn = _owner_fns.get(collection)
    return fn(data) if fn and data else None


def register_keys(collection: str, version: str, fn: Callable[[dict], Iterable[tuple[str, str]]]) -> None:
    _key_fns[collection] = (version, fn)
    _keys_ready.discard(collection)


def _keys_of(collection: str, rid: str, data: Optional[dict]) -> list:
    entry = _key_fns.get(collection)
    if not entry or not data:
        return []
    return [(kind, value, collection, rid) for kind, value in dict.fromkeys(entry[1](data))]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ==========================================
# Backends
# ==========================================
class _Postgres:
    name = "postgres"

    def __init__(self, url: str):
        from psycopg_pool import ConnectionPool
        size = int(os.environ.get("DB_POOL_SIZE") or 12)  # per worker; workers x size must stay under max_connections
        self.pool = ConnectionPool(url, min_size=1, max_size=size, kwargs={"autocommit": True}, open=True)

    def sql(self, query: str) -> str:
        return query.replace("?", "%s")

    @contextlib.contextmanager
    def connect(self):
        with self.pool.connection() as conn:
            yield conn

    @contextlib.contextmanager
    def write_tx(self, conn):
        with conn.transaction():
            conn.execute("SELECT pg_advisory_xact_lock(%s)", (_WRITE_LOCK_KEY,))
            yield

    def next_seqs(self, conn, n: int) -> list:
        rows = conn.execute("SELECT nextval('records_seq_counter') FROM generate_series(1, %s)", (n,)).fetchall()
        return sorted(r[0] for r in rows)

    text_column = "data"

    def load(self, value):
        return json.loads(value) if value is not None else None

    def dump(self, value) -> str:
        return json.dumps(value)

    def json_param(self) -> str:
        return "?"

    def init_schema(self, conn) -> None:
        with self.write_tx(conn):
            conn.execute("CREATE SEQUENCE IF NOT EXISTS records_seq_counter")
            conn.execute("""CREATE TABLE IF NOT EXISTS records (
                collection TEXT NOT NULL, id TEXT NOT NULL, owner TEXT, data TEXT,
                seq BIGINT NOT NULL, deleted BOOLEAN NOT NULL DEFAULT FALSE, updated_at TEXT NOT NULL,
                PRIMARY KEY (collection, id))""")
            conn.execute("CREATE INDEX IF NOT EXISTS records_by_seq ON records (collection, seq)")
            conn.execute("CREATE INDEX IF NOT EXISTS records_seq ON records (seq)")
            conn.execute("CREATE INDEX IF NOT EXISTS records_by_owner ON records (collection, owner, seq)")
            conn.execute("""CREATE TABLE IF NOT EXISTS record_moves (
                seq BIGINT NOT NULL, collection TEXT NOT NULL, id TEXT NOT NULL, old_owner TEXT)""")
            conn.execute("CREATE INDEX IF NOT EXISTS record_moves_by_seq ON record_moves (seq)")
            conn.execute("""CREATE TABLE IF NOT EXISTS record_keys (
                kind TEXT NOT NULL, value TEXT NOT NULL, collection TEXT NOT NULL, id TEXT NOT NULL)""")
            conn.execute("CREATE INDEX IF NOT EXISTS record_keys_lookup ON record_keys (kind, value, collection)")
            conn.execute("CREATE INDEX IF NOT EXISTS record_keys_by_record ON record_keys (collection, id)")
            conn.execute("CREATE TABLE IF NOT EXISTS record_keys_built (collection TEXT PRIMARY KEY, version TEXT NOT NULL)")


class _SQLite:
    name = "sqlite"

    def __init__(self, path: str):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self.path = path
        self.local = threading.local()

    def sql(self, query: str) -> str:
        return query

    @contextlib.contextmanager
    def connect(self):
        conn = getattr(self.local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(self.path, timeout=30, isolation_level=None, check_same_thread=False)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA busy_timeout=30000")
            self.local.conn = conn
        yield conn

    @contextlib.contextmanager
    def write_tx(self, conn):
        conn.execute("BEGIN IMMEDIATE")
        try:
            yield
        except BaseException:
            conn.execute("ROLLBACK")
            raise
        conn.execute("COMMIT")

    def next_seqs(self, conn, n: int) -> list:
        conn.execute("UPDATE seq_counter SET value = value + ?", (n,))
        top = conn.execute("SELECT value FROM seq_counter").fetchone()[0]
        return list(range(top - n + 1, top + 1))

    text_column = "data"

    def load(self, value):
        return json.loads(value) if value is not None else None

    def dump(self, value) -> str:
        return json.dumps(value)

    def json_param(self) -> str:
        return "?"

    def init_schema(self, conn) -> None:
        with self.write_tx(conn):
            conn.execute("CREATE TABLE IF NOT EXISTS seq_counter (value INTEGER NOT NULL)")
            if conn.execute("SELECT COUNT(*) FROM seq_counter").fetchone()[0] == 0:
                conn.execute("INSERT INTO seq_counter (value) VALUES (0)")
            conn.execute("""CREATE TABLE IF NOT EXISTS records (
                collection TEXT NOT NULL, id TEXT NOT NULL, owner TEXT, data TEXT,
                seq INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
                PRIMARY KEY (collection, id))""")
            conn.execute("CREATE INDEX IF NOT EXISTS records_by_seq ON records (collection, seq)")
            conn.execute("CREATE INDEX IF NOT EXISTS records_seq ON records (seq)")
            conn.execute("CREATE INDEX IF NOT EXISTS records_by_owner ON records (collection, owner, seq)")
            conn.execute("""CREATE TABLE IF NOT EXISTS record_moves (
                seq INTEGER NOT NULL, collection TEXT NOT NULL, id TEXT NOT NULL, old_owner TEXT)""")
            conn.execute("CREATE INDEX IF NOT EXISTS record_moves_by_seq ON record_moves (seq)")
            conn.execute("""CREATE TABLE IF NOT EXISTS record_keys (
                kind TEXT NOT NULL, value TEXT NOT NULL, collection TEXT NOT NULL, id TEXT NOT NULL)""")
            conn.execute("CREATE INDEX IF NOT EXISTS record_keys_lookup ON record_keys (kind, value, collection)")
            conn.execute("CREATE INDEX IF NOT EXISTS record_keys_by_record ON record_keys (collection, id)")
            conn.execute("CREATE TABLE IF NOT EXISTS record_keys_built (collection TEXT PRIMARY KEY, version TEXT NOT NULL)")


def backend():
    global _backend
    if _backend is None:
        with _init_lock:
            if _backend is None:
                url = os.environ.get("DATABASE_URL", "").strip()
                _backend = _Postgres(url) if url else _SQLite(os.environ.get("CRM_SQLITE_PATH") or DEFAULT_SQLITE_PATH)
                with _backend.connect() as conn:
                    _backend.init_schema(conn)
    return _backend


def reset_backend() -> None:
    """Forget the current connection (tests point CRM_SQLITE_PATH at a fresh file, then call this)."""
    global _backend
    if isinstance(_backend, _Postgres):
        _backend.pool.close()
    _backend = None
    _keys_ready.clear()


# ==========================================
# Connections and transactions
# ==========================================
@contextlib.contextmanager
def transaction():
    """Group several writes atomically. Reads inside see the transaction's own writes."""
    active = _current.get()
    if active is not None:
        yield  # nested: join the outer transaction
        return
    db = backend()
    with db.connect() as conn:
        with db.write_tx(conn):
            token = _current.set(conn)
            try:
                yield
            finally:
                _current.reset(token)


@contextlib.contextmanager
def _conn():
    active = _current.get()
    if active is not None:
        yield active
        return
    with backend().connect() as conn:
        yield conn


def _rows(query: str, params: Iterable = ()) -> list:
    db = backend()
    with _conn() as conn:
        return conn.execute(db.sql(query), tuple(params)).fetchall()


# ==========================================
# Reads
# ==========================================
def get(collection: str, record_id: str) -> Optional[dict]:
    rows = _rows("SELECT data FROM records WHERE collection = ? AND id = ? AND deleted = ?",
                 (collection, record_id, False))
    return backend().load(rows[0][0]) if rows else None


def _chunks(items: list, size: int = 500):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def _select_live(column: str, collection: str, owners: Optional[Iterable[str]]) -> list:
    query = f"SELECT {column} FROM records WHERE collection = ? AND deleted = ?"
    params: list = [collection, False]
    if owners is not None:
        owners = list(owners)
        if not owners:
            return []
        query += f" AND owner IN ({', '.join('?' for _ in owners)})"
        params += owners
    return [r[0] for r in _rows(query + " ORDER BY seq", params)]


def all(collection: str, owners: Optional[Iterable[str]] = None) -> list:
    """Every live record in a collection, oldest write first; optionally only those owned by `owners`."""
    db = backend()
    return [db.load(d) for d in _select_live("data", collection, owners)]


def all_json(collection: str, owners: Optional[Iterable[str]] = None) -> list:
    """Like all(), but each record as its stored JSON text: no parsing, for sending straight to browsers."""
    return _select_live(backend().text_column, collection, owners)


def containing(collection: str, text: str) -> list:
    """Live records whose stored JSON contains `text` (any case): a cheap SQL pre-filter, so the
    caller parses only likely matches instead of a whole collection. `text` must hold no % or _."""
    db = backend()
    rows = _rows(f"SELECT {db.text_column} FROM records WHERE collection = ? AND deleted = ? AND UPPER({db.text_column}) LIKE ?",
                 (collection, False, f"%{text.upper()}%"))
    return [db.load(r[0]) for r in rows]


def _ensure_keys(collection: str) -> None:
    """Build `record_keys` for a collection the first time it is used with this key version (records
    written before the keys existed). Runs under the write lock, so no write can slip in between."""
    if collection in _keys_ready or collection not in _key_fns:
        return
    version = _key_fns[collection][0]
    db = backend()
    with transaction():
        with _conn() as conn:
            row = conn.execute(db.sql("SELECT version FROM record_keys_built WHERE collection = ?"), (collection,)).fetchone()
            if not row or row[0] != version:
                conn.execute(db.sql("DELETE FROM record_keys WHERE collection = ?"), (collection,))
                live = conn.execute(db.sql(f"SELECT id, {db.text_column} FROM records WHERE collection = ? AND deleted = ?"),
                                    (collection, False)).fetchall()
                keys = [k for rid, text in live for k in _keys_of(collection, rid, db.load(text))]
                if keys:
                    conn.cursor().executemany(db.sql("INSERT INTO record_keys (kind, value, collection, id) VALUES (?, ?, ?, ?)"), keys)
                conn.execute(db.sql("""INSERT INTO record_keys_built (collection, version) VALUES (?, ?)
                                       ON CONFLICT (collection) DO UPDATE SET version = excluded.version"""), (collection, version))
    _keys_ready.add(collection)


def find_by_key(collection: str, kind: str, value: str) -> list:
    """Live records of a collection holding the lookup key (kind, value); see register_keys."""
    if collection not in _key_fns:
        raise ValueError(f"no lookup keys registered for {collection}")
    _ensure_keys(collection)
    db = backend()
    rows = _rows(f"""SELECT r.{db.text_column} FROM record_keys k
                     JOIN records r ON r.collection = k.collection AND r.id = k.id
                     WHERE k.kind = ? AND k.value = ? AND k.collection = ? AND r.deleted = ?""",
                 (kind, value, collection, False))
    return [db.load(r[0]) for r in rows]


def _drop_keys(conn, collection: str, ids: list) -> None:
    db = backend()
    for chunk in _chunks(ids):
        conn.execute(db.sql(f"DELETE FROM record_keys WHERE collection = ? AND id IN ({', '.join('?' for _ in chunk)})"),
                     tuple([collection, *chunk]))


def get_many(collection: str, record_ids: Iterable[str]) -> dict:
    """{id: record} for the ids that exist."""
    db = backend()
    found = {}
    for chunk in _chunks(list(dict.fromkeys(record_ids))):
        rows = _rows(f"SELECT id, data FROM records WHERE collection = ? AND deleted = ? AND id IN ({', '.join('?' for _ in chunk)})",
                     [collection, False, *chunk])
        found.update((rid, db.load(data)) for rid, data in rows)
    return found


def count(collection: str) -> int:
    return _rows("SELECT COUNT(*) FROM records WHERE collection = ? AND deleted = ?", (collection, False))[0][0]


def cursor() -> int:
    rows = _rows("SELECT MAX(seq) FROM records")
    return rows[0][0] or 0


def changes(scopes: dict, since: int) -> dict:
    """What changed after `since`, for incremental sync.

    `scopes` maps each collection to None (every record) or the owners whose records to include,
    filtered in SQL so a large upload does not cost every browser's next poll.
    Returns `rows` as (collection, id, owner, json_text, deleted) in write order, `moves` as
    (collection, id, old_owner) for records that left one of those owners, and the new `cursor`.
    """
    db = backend()
    with _conn() as conn:
        # Read the cursor first: anything committed after it is picked up by the next call
        top = conn.execute(db.sql("SELECT MAX(seq) FROM records")).fetchone()[0] or 0
        rows, moves = [], []
        if top <= since:
            return {"rows": rows, "moves": moves, "cursor": max(since, top)}
        for collection, owners in scopes.items():
            query = f"SELECT collection, id, owner, {db.text_column}, deleted, seq FROM records WHERE collection = ? AND seq > ? AND seq <= ?"
            params: list = [collection, since, top]
            if owners is not None:
                owners = list(owners)
                if not owners:
                    continue
                marks = ", ".join("?" for _ in owners)
                query += f" AND owner IN ({marks})"
                params += owners
                moves += conn.execute(db.sql(
                    f"SELECT collection, id, old_owner FROM record_moves WHERE collection = ? AND seq > ? AND seq <= ? AND old_owner IN ({marks})"),
                    tuple([collection, since, top] + owners)).fetchall()
            rows += conn.execute(db.sql(query), tuple(params)).fetchall()
    rows.sort(key=lambda r: r[5])
    return {"rows": [(c, i, o, d, bool(x)) for c, i, o, d, x, _ in rows],
            "moves": [tuple(m) for m in moves], "cursor": top}


# ==========================================
# Writes
# ==========================================
def put_pairs(collection: str, pairs: list) -> int:
    """Insert or replace many records [(id, data), ...] in one transaction with batched statements."""
    if not pairs:
        return 0
    db = backend()
    with transaction():
        with _conn() as conn:
            previous = {}
            for chunk in _chunks([rid for rid, _ in pairs]):
                rows = conn.execute(db.sql(
                    f"SELECT id, owner, deleted FROM records WHERE collection = ? AND id IN ({', '.join('?' for _ in chunk)})"),
                    tuple([collection, *chunk])).fetchall()
                previous.update((rid, (owner, deleted)) for rid, owner, deleted in rows)
            now, rows, moves = _now(), [], []
            for (rid, data), seq in zip(pairs, db.next_seqs(conn, len(pairs))):
                owner = owner_of(collection, data)
                rows.append((collection, rid, owner, db.dump(data), seq, False, now))
                old_owner, was_deleted = previous.get(rid, (None, True))
                if not was_deleted and old_owner and old_owner != owner:
                    moves.append((seq, collection, rid, old_owner))
                previous[rid] = (owner, False)
            cur = conn.cursor()
            cur.executemany(db.sql(
                f"""INSERT INTO records (collection, id, owner, data, seq, deleted, updated_at)
                    VALUES (?, ?, ?, {db.json_param()}, ?, ?, ?)
                    ON CONFLICT (collection, id) DO UPDATE SET owner = excluded.owner, data = excluded.data,
                        seq = excluded.seq, deleted = excluded.deleted, updated_at = excluded.updated_at"""), rows)
            if moves:
                cur.executemany(db.sql("INSERT INTO record_moves (seq, collection, id, old_owner) VALUES (?, ?, ?, ?)"), moves)
            if collection in _key_fns:
                _drop_keys(conn, collection, list(dict.fromkeys(rid for rid, _ in pairs)))
                latest = dict(pairs)  # the last write of an id wins, as in the records table
                keys = [k for rid, data in latest.items() for k in _keys_of(collection, rid, data)]
                if keys:
                    cur.executemany(db.sql("INSERT INTO record_keys (kind, value, collection, id) VALUES (?, ?, ?, ?)"), keys)
    return len(pairs)


def put(collection: str, record_id: str, data: dict) -> dict:
    """Insert or replace one record."""
    put_pairs(collection, [(record_id, data)])
    return data


def put_many(collection: str, docs: Iterable[dict], key: str = "id") -> int:
    return put_pairs(collection, [(doc[key], doc) for doc in docs])


def delete_many(collection: str, record_ids: Iterable[str]) -> list:
    """Replace records with tombstones in one batch. Returns the ids that existed (and are now deleted)."""
    db = backend()
    ids = list(dict.fromkeys(record_ids))
    with transaction():
        with _conn() as conn:
            live = []
            for chunk in _chunks(ids):
                rows = conn.execute(db.sql(
                    f"SELECT id FROM records WHERE collection = ? AND deleted = ? AND id IN ({', '.join('?' for _ in chunk)})"),
                    tuple([collection, False, *chunk])).fetchall()
                live += [r[0] for r in rows]
            if live:
                now = _now()
                conn.cursor().executemany(
                    db.sql("UPDATE records SET deleted = ?, data = NULL, seq = ?, updated_at = ? WHERE collection = ? AND id = ?"),
                    [(True, seq, now, collection, rid) for rid, seq in zip(live, db.next_seqs(conn, len(live)))])
                if collection in _key_fns:
                    _drop_keys(conn, collection, live)
    return live


def delete(collection: str, record_id: str) -> bool:
    """Replace the record with a tombstone. Returns False when it did not exist."""
    return bool(delete_many(collection, [record_id]))


# ==========================================
# Single values (settings, small state)
# ==========================================
def get_value(name: str, default=None):
    doc = get("kv", name)
    return doc["value"] if doc is not None else default


def set_value(name: str, value) -> None:
    put("kv", name, {"id": name, "value": value})


@contextlib.contextmanager
def update_value(name: str, default):
    """Read-modify-write one value atomically: `with update_value("x", {}) as box: box[0][k] = v`."""
    with transaction():
        box = [get_value(name, default)]
        yield box
        set_value(name, box[0])
