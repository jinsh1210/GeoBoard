import sqlite3
from pathlib import Path

DB_PATH = str(Path(__file__).resolve().parent / "geoboard.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS facilities (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT,
            type        TEXT,
            closed_day  TEXT,
            open_time   TEXT,
            close_time  TEXT,
            is_paid     TEXT,
            capacity    TEXT,
            fee         TEXT,
            address     TEXT,
            phone       TEXT,
            lat         REAL,
            lng         REAL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS restrooms (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            name    TEXT,
            gu      TEXT,
            address TEXT,
            year    INTEGER,
            lat     REAL,
            lng     REAL
        )
    """)
    conn.commit()
    conn.close()
