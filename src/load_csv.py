import pandas as pd
import sqlite3
from db import DB_PATH, init_db

def load():
    init_db()

    CSV_PATH = "../data/인천광역시_미추홀구_공공시설개방정보_20251101.csv"

    df = pd.read_csv(
        CSV_PATH,
        encoding="utf-8-sig"
    )

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM facilities")

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
            float(row.get("위도", 0)),
            float(row.get("경도", 0)),
        ))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    load()