import os
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

DATABASE_URL = os.environ.get("DATABASE_URL", "")
_use_pg = bool(DATABASE_URL)

if _use_pg:
    import psycopg2
    import psycopg2.extras
else:
    import sqlite3

DB_PATH = Path("/tmp/flashcards.db") if os.environ.get("VERCEL") else Path(__file__).parent / "flashcards.db"

def _q(sql):
    if _use_pg:
        sql = sql.replace("?", "%s")
        sql = sql.replace("datetime('now')", "NOW()")
        sql = sql.replace("AUTOINCREMENT", "GENERATED ALWAYS AS IDENTITY")
    return sql

def get_db():
    if _use_pg:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        return conn
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def _exec(conn, sql, params=None):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) if _use_pg else conn.cursor()
    cur.execute(_q(sql), params or ())
    return cur

def _fetchone(cur):
    row = cur.fetchone()
    return dict(row) if row else None

def _fetchall(cur):
    return [dict(r) for r in cur.fetchall()]

def _lastid(cur, conn):
    if _use_pg:
        return cur.fetchone()["id"]
    return cur.lastrowid

def init_db():
    conn = get_db()
    sql = """
        CREATE TABLE IF NOT EXISTS sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            source TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
            term TEXT NOT NULL,
            definition TEXT NOT NULL,
            card_type TEXT NOT NULL DEFAULT 'term',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            ease_factor REAL NOT NULL DEFAULT 2.5,
            interval_seconds REAL NOT NULL DEFAULT 0,
            repetitions INTEGER NOT NULL DEFAULT 0,
            last_review TEXT,
            next_review TEXT NOT NULL DEFAULT (datetime('now')),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """
    if _use_pg:
        for stmt in sql.split(";"):
            stmt = stmt.strip()
            if stmt:
                _exec(conn, stmt)
        conn.commit()
    else:
        conn.executescript(sql)
    try:
        _exec(conn, "ALTER TABLE cards ADD COLUMN card_type TEXT NOT NULL DEFAULT 'term'")
        conn.commit()
    except Exception:
        pass
    conn.close()

def create_set(title, source=""):
    conn = get_db()
    cur = _exec(conn, "INSERT INTO sets (title, source) VALUES (?, ?) RETURNING id" if _use_pg else "INSERT INTO sets (title, source) VALUES (?, ?)", (title, source))
    set_id = _lastid(cur, conn)
    conn.commit()
    conn.close()
    return set_id

def get_sets():
    conn = get_db()
    rows = _fetchall(_exec(conn, """
        SELECT s.*, (SELECT COUNT(*) FROM cards WHERE set_id = s.id) as card_count
        FROM sets s ORDER BY s.updated_at DESC
    """))
    conn.close()
    return rows

def get_set(set_id):
    conn = get_db()
    row = _fetchone(_exec(conn, "SELECT * FROM sets WHERE id = ?", (set_id,)))
    conn.close()
    return row

def delete_set(set_id):
    conn = get_db()
    _exec(conn, "DELETE FROM sets WHERE id = ?", (set_id,))
    conn.commit()
    conn.close()

def add_cards(set_id, cards):
    conn = get_db()
    for card in cards:
        card_type = card.get("card_type", "term")
        cur = _exec(conn, "INSERT INTO cards (set_id, term, definition, card_type) VALUES (?, ?, ?, ?)", (set_id, card["term"], card["definition"], card_type))
        card_id = _lastid(cur, conn)
        _exec(conn, "INSERT INTO reviews (card_id) VALUES (?)", (card_id,))
    _exec(conn, "UPDATE sets SET updated_at = datetime('now') WHERE id = ?", (set_id,))
    conn.commit()
    conn.close()

def get_cards(set_id):
    conn = get_db()
    rows = _fetchall(_exec(conn,
        "SELECT c.*, r.ease_factor, r.interval_seconds, r.repetitions, r.last_review, r.next_review "
        "FROM cards c LEFT JOIN reviews r ON r.card_id = c.id "
        "WHERE c.set_id = ? ORDER BY c.id", (set_id,)
    ))
    conn.close()
    return rows

def get_due_cards(set_id):
    conn = get_db()
    rows = _fetchall(_exec(conn,
        "SELECT c.*, r.ease_factor, r.interval_seconds, r.repetitions, r.last_review, r.next_review, r.id as review_id "
        "FROM cards c JOIN reviews r ON r.card_id = c.id "
        "WHERE c.set_id = ? AND r.next_review <= datetime('now') "
        "ORDER BY r.next_review ASC", (set_id,)
    ))
    conn.close()
    return rows

def record_review(card_id, quality):
    from spaced_repetition import next_review, update_ease_factor
    conn = get_db()
    row = _fetchone(_exec(conn, "SELECT * FROM reviews WHERE card_id = ?", (card_id,)))
    now = datetime.now(timezone.utc)

    if row:
        current_interval = timedelta(seconds=row["interval_seconds"])
        ef = row["ease_factor"]
        reps = row["repetitions"]
    else:
        current_interval = timedelta(0)
        ef = 2.5
        reps = 0

    new_interval = next_review(current_interval, ef, quality)
    new_ef = update_ease_factor(ef, quality)
    reps = reps + 1 if quality >= 2 else 0
    next_review_time = (now + new_interval).isoformat()
    now_iso = now.isoformat()

    if row:
        _exec(conn, "UPDATE reviews SET ease_factor=?, interval_seconds=?, repetitions=?, last_review=?, next_review=? WHERE card_id=?",
              (new_ef, new_interval.total_seconds(), reps, now_iso, next_review_time, card_id))
    else:
        _exec(conn, "INSERT INTO reviews (card_id, ease_factor, interval_seconds, repetitions, last_review, next_review) VALUES (?,?,?,?,?,?)",
              (card_id, new_ef, new_interval.total_seconds(), reps, now_iso, next_review_time))
    conn.commit()
    conn.close()

def get_stats(set_id):
    conn = get_db()
    total = _fetchone(_exec(conn, "SELECT COUNT(*) as cnt FROM cards WHERE set_id = ?", (set_id,)))["cnt"]
    studied = _fetchone(_exec(conn,
        "SELECT COUNT(*) as cnt FROM cards c JOIN reviews r ON r.card_id = c.id "
        "WHERE c.set_id = ? AND r.repetitions > 0", (set_id,)
    ))["cnt"]
    due = _fetchone(_exec(conn,
        "SELECT COUNT(*) as cnt FROM cards c JOIN reviews r ON r.card_id = c.id "
        "WHERE c.set_id = ? AND r.next_review <= datetime('now')", (set_id,)
    ))["cnt"]
    conn.close()
    return {"total": total, "studied": studied, "due": due}
