import pandas as pd
import sqlite3
from pathlib import Path
from db import DB_PATH, init_db

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

def load():
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 공공시설
    fac_path = DATA_DIR / "인천광역시_미추홀구_공공시설개방정보_20251101.csv"
    if fac_path.exists():
        cursor.execute("DELETE FROM facilities")
        df = pd.read_csv(fac_path, encoding="utf-8-sig")
        for _, row in df.iterrows():
            cursor.execute("""
                INSERT INTO facilities
                (name, type, closed_day, open_time, close_time,
                 is_paid, capacity, fee, address, phone, lat, lng)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                row.get("개방시설명"),
                row.get("개방시설유형구분"),
                row.get("휴관일"),
                row.get("평일운영시작시각"),
                row.get("평일운영종료시각"),
                row.get("유료사용여부"),
                str(row.get("수용가능인원수", "")),
                str(row.get("사용료", "")),
                row.get("소재지도로명주소"),
                row.get("사용안내전화번호"),
                float(row.get("위도", 0) or 0),
                float(row.get("경도", 0) or 0),
            ))

    # 민간개방 화장실
    rest_path = DATA_DIR / "restrooms_geocoded.csv"
    if rest_path.exists():
        cursor.execute("DELETE FROM restrooms")
        df2 = pd.read_csv(rest_path, encoding="utf-8-sig")
        for _, row in df2.iterrows():
            cursor.execute("""
                INSERT INTO restrooms (name, gu, address, year, lat, lng)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                row.get("시설명"),
                row.get("군구"),
                row.get("소재지"),
                int(row["지정년도"]) if pd.notna(row.get("지정년도")) else None,
                float(row.get("lat", 0) or 0),
                float(row.get("lng", 0) or 0),
            ))

    conn.commit()
    conn.close()
