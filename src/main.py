from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import sqlite3
from pathlib import Path
from db import DB_PATH, init_db
from load_csv import load

app = FastAPI()

BASE = Path(__file__).resolve().parent.parent


def query_db(sql: str, params: list) -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
    conn.close()
    return rows


@app.on_event("startup")
def startup():
    load()


app.mount("/static", StaticFiles(directory=str(BASE / "static")), name="static")


@app.get("/")
def root():
    return FileResponse(str(BASE / "static" / "index.html"))


@app.get("/api/facilities")
def get_facilities(
    keyword: str = Query(""),
    type: str = Query(""),
    is_paid: str = Query(""),
):
    sql = "SELECT * FROM facilities WHERE 1=1"
    params = []
    if keyword:
        sql += " AND (name LIKE ? OR address LIKE ?)"
        params += [f"%{keyword}%", f"%{keyword}%"]
    if type:
        sql += " AND type = ?"
        params.append(type)
    if is_paid:
        sql += " AND is_paid = ?"
        params.append(is_paid)
    return query_db(sql, params)


@app.get("/api/restrooms")
def get_restrooms(
    keyword: str = Query(""),
    gu: str = Query(""),
):
    sql = "SELECT * FROM restrooms WHERE 1=1"
    params = []
    if keyword:
        sql += " AND (name LIKE ? OR address LIKE ?)"
        params += [f"%{keyword}%", f"%{keyword}%"]
    if gu:
        sql += " AND gu = ?"
        params.append(gu)
    return query_db(sql, params)
