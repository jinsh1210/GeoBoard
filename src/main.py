from fastapi import FastAPI, Query, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import sqlite3, os, httpx
from pathlib import Path
from db import DB_PATH, init_db
from load_csv import load

KAKAO_KEY = os.getenv("KAKAO_API_KEY", "")

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


@app.get("/api/suggest")
async def suggest(q: str = Query(...)):
    if not KAKAO_KEY or len(q) < 2:
        return []
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://dapi.kakao.com/v2/local/search/keyword.json",
            params={"query": q, "size": 5},
            headers={"Authorization": f"KakaoAK {KAKAO_KEY}"},
        )
    docs = r.json().get("documents", [])
    return [{"name": d["place_name"], "address": d["road_address_name"] or d["address_name"], "lat": float(d["y"]), "lng": float(d["x"])} for d in docs]


@app.get("/api/geocode")
async def geocode(q: str = Query(...)):
    if not KAKAO_KEY:
        raise HTTPException(status_code=500, detail="KAKAO_API_KEY not set")
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://dapi.kakao.com/v2/local/search/address.json",
            params={"query": q, "size": 1},
            headers={"Authorization": f"KakaoAK {KAKAO_KEY}"},
        )
    docs = r.json().get("documents", [])
    if not docs:
        # 주소 검색 실패 시 키워드 검색 시도
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://dapi.kakao.com/v2/local/search/keyword.json",
                params={"query": q, "size": 1},
                headers={"Authorization": f"KakaoAK {KAKAO_KEY}"},
            )
        docs = r.json().get("documents", [])
    if not docs:
        raise HTTPException(status_code=404, detail="주소를 찾을 수 없습니다")
    doc = docs[0]
    return {"lat": float(doc["y"]), "lng": float(doc["x"])}


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
