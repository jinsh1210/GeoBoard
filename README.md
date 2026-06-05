<img src="ICON_URL" align="left" height="100" alt="GeoBoard icon" />

# GeoBoard
인천광역시 공공시설·민간개방 화장실 위치를 지도 위에서 검색·조회하는 GIS 웹 애플리케이션

[![GitHub release](https://img.shields.io/github/v/release/jinsh1210/GeoBoard)](https://github.com/jinsh1210/GeoBoard/releases/latest)
[![License](https://img.shields.io/github/license/jinsh1210/GeoBoard)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-web-lightgrey)](https://github.com/jinsh1210/GeoBoard)
[![Python](https://img.shields.io/badge/python-3.9+-blue)](https://www.python.org)

<br />

## Screenshots

![Screenshot](SCREENSHOT_URL)

## Features

- **이중 레이어 전환**: 사이드바 토글로 공공시설(24개소)과 민간개방 화장실(183개소)을 즉시 전환
- **공공시설 필터**: 시설 유형(다목적실·회의실·강의실 등)과 유/무료 여부로 검색 범위 축소
- **화장실 필터**: 군구(중구·미추홀구·부평구 등 9개 구)별 필터링
- **지도 팝업**: 마커 클릭 시 시설명·운영시간·주소·전화번호 등 상세 정보 표시
- **카드 연동**: 사이드바 결과 카드 클릭 시 지도가 해당 위치로 자동 이동
- **REST API**: `/api/facilities`, `/api/restrooms` 엔드포인트로 검색 쿼리 처리

## Installation

### Requirements

- Python 3.9+

### Run locally

```sh
# 1. Clone
git clone https://github.com/jinsh1210/GeoBoard.git
cd GeoBoard

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start server
PYTHONPATH=src uvicorn src.main:app --reload --port 8000
```

브라우저에서 `http://localhost:8000` 접속

## Project Structure

```
GeoBoard/
├── data/
│   ├── 인천광역시_미추홀구_공공시설개방정보_20251101.csv
│   └── restrooms_geocoded.csv      # Kakao Local API로 좌표 변환 (183/183)
├── src/
│   ├── main.py                     # FastAPI 앱 및 API 라우터
│   ├── db.py                       # SQLite 스키마 초기화
│   └── load_csv.py                 # CSV → SQLite 로더 (시작 시 자동 실행)
├── static/
│   ├── index.html                  # 메인 페이지
│   ├── map.js                      # Leaflet 지도·마커·검색 로직
│   └── style.css                   # 스타일
└── requirements.txt
```

## API Reference

| Method | Path | Parameters | Description |
|--------|------|------------|-------------|
| GET | `/api/facilities` | `keyword`, `type`, `is_paid` | 공공시설 검색 |
| GET | `/api/restrooms` | `keyword`, `gu` | 민간개방 화장실 검색 |

## Data Sources

| 데이터 | 출처 | 건수 |
|--------|------|------|
| 인천광역시 미추홀구 공공시설개방정보 | 공공데이터포털 | 24 |
| 인천광역시 민간개방 화장실 현황 | 인천광역시 공공데이터 | 183 |

좌표 변환: [Kakao Local API](https://developers.kakao.com/docs/latest/ko/local/dev-guide) `/v2/local/search/address.json` — 183/183 (100%)

## Credits

- [FastAPI](https://fastapi.tiangolo.com) — Python REST API 프레임워크
- [Leaflet.js](https://leafletjs.com) — 인터랙티브 웹 지도 라이브러리
- [OpenStreetMap](https://www.openstreetmap.org) — 오픈소스 지도 타일
- [Kakao Local API](https://developers.kakao.com) — 한국 주소 지오코딩
- [pandas](https://pandas.pydata.org) — CSV 데이터 처리

## License

[MIT](LICENSE)
