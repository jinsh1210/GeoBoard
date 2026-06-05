from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import sqlite3
from db import DB_PATH, init_db
from load_csv import load

app = FastAPI()

@app.on_event("startup")
def startup():
    load()

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def root():
    return FileResponse("static/index.html")

@app.get("/api/facilities")
def get_facilities(
    keyword: str = Query(""),
    type: str = Query(""),
    is_paid: str = Query
):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = "SELECT * FROM facilities WHERE 1=1"
    params = []

    if keyword:
        query += " AND (name LIKE ? OR address LIKE ?)"
        params += [f"%{keyword}%", f"%{keyword}%"]
    if type:
        query += " AND type = ?"
        params.append(type)
    if is_paid:
        query += " AND is_paid = ?"
        params.append(is_paid)
    
    cursor.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows