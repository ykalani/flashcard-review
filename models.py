import os
import sqlite3
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

DB_PATH = Path("/tmp/flashcards.db") if os.environ.get("VERCEL") else Path(__file__).parent / "flashcards.db"

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
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
    """)
    conn.commit()
    conn.close()

def create_set(title, source=""):
    conn = get_db()
    cur = conn.execute("INSERT INTO sets (title, source) VALUES (?, ?)", (title, source))
    set_id = cur.lastrowid
    conn.commit()
    conn.close()
    return set_id

def get_sets():
    conn = get_db()
    rows = conn.execute("""
        SELECT s.*, (SELECT COUNT(*) FROM cards WHERE set_id = s.id) as card_count
        FROM sets s ORDER BY s.updated_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_set(set_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM sets WHERE id = ?", (set_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def delete_set(set_id):
    conn = get_db()
    conn.execute("DELETE FROM sets WHERE id = ?", (set_id,))
    conn.commit()
    conn.close()

def add_cards(set_id, cards):
    conn = get_db()
    for card in cards:
        cur = conn.execute(
            "INSERT INTO cards (set_id, term, definition) VALUES (?, ?, ?)",
            (set_id, card["term"], card["definition"])
        )
        card_id = cur.lastrowid
        conn.execute(
            "INSERT INTO reviews (card_id) VALUES (?)",
            (card_id,)
        )
    conn.execute("UPDATE sets SET updated_at = datetime('now') WHERE id = ?", (set_id,))
    conn.commit()
    conn.close()

def get_cards(set_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT c.*, r.ease_factor, r.interval_seconds, r.repetitions, r.last_review, r.next_review "
        "FROM cards c LEFT JOIN reviews r ON r.card_id = c.id "
        "WHERE c.set_id = ? ORDER BY c.id", (set_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_due_cards(set_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT c.*, r.ease_factor, r.interval_seconds, r.repetitions, r.last_review, r.next_review, r.id as review_id "
        "FROM cards c JOIN reviews r ON r.card_id = c.id "
        "WHERE c.set_id = ? AND r.next_review <= datetime('now') "
        "ORDER BY r.next_review ASC", (set_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def record_review(card_id, quality):
    from spaced_repetition import next_review, update_ease_factor, MINUTES_1, MINUTES_10
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM reviews WHERE card_id = ?", (card_id,)
    ).fetchone()
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

    if quality >= 2:
        reps += 1
    else:
        reps = 0

    next_review_time = (now + new_interval).isoformat()
    now_iso = now.isoformat()

    if row:
        conn.execute(
            "UPDATE reviews SET ease_factor=?, interval_seconds=?, repetitions=?, last_review=?, next_review=? WHERE card_id=?",
            (new_ef, new_interval.total_seconds(), reps, now_iso, next_review_time, card_id)
        )
    else:
        conn.execute(
            "INSERT INTO reviews (card_id, ease_factor, interval_seconds, repetitions, last_review, next_review) VALUES (?,?,?,?,?,?)",
            (card_id, new_ef, new_interval.total_seconds(), reps, now_iso, next_review_time)
        )
    conn.commit()
    conn.close()

def get_stats(set_id):
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM cards WHERE set_id = ?", (set_id,)).fetchone()[0]
    studied = conn.execute(
        "SELECT COUNT(*) FROM cards c JOIN reviews r ON r.card_id = c.id "
        "WHERE c.set_id = ? AND r.repetitions > 0", (set_id,)
    ).fetchone()[0]
    due = conn.execute(
        "SELECT COUNT(*) FROM cards c JOIN reviews r ON r.card_id = c.id "
        "WHERE c.set_id = ? AND r.next_review <= datetime('now')", (set_id,)
    ).fetchone()[0]
    conn.close()
    return {"total": total, "studied": studied, "due": due}
