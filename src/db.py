import sqlite3

DB_PATH = "geoboard.db"

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
    conn.commit()
    conn.close()
    
def get_conn():
    return sqlite3.connect(DB_PATH)