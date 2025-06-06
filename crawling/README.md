# 🔥 Fire Data Automation System (crawling/)

본 시스템은 대한민국 산불 정보를 실시간으로 수집하고, 기상 및 위성 데이터와 통합하여
최종 시각화에 사용할 수 있는 JSON 파일을 매일 자동으로 생성합니다.

---

## 📁 폴더 구조 개요

```
crawling/
├── fetch_forest_data.py           # 산림청 산불발생정보 크롤링
├── augment_weather.py             # Meteostat, Weatherbit 기상 정보 병합
├── fetch_firms_data.py           # NASA FIRMS 위성 화재 데이터 다운로드
├── augment_firms_improved.py     # NASA + 화재 데이터 최종 병합 (매칭 최적화)
├── README.md                      # ← 본 문서
```

---

## ⚙️ 전체 자동화 흐름

GitHub Actions에서 `update_fire_data.yml`을 통해 매일 새벽 1시 자동 실행됩니다.

### 실행 순서

1. `fetch_forest_data.py`  
   → 산림청 사이트에서 최근 7일간 화재 발생지 위경도 수집

2. `augment_weather.py`  
   → 각 화재 지점에 대한 과거 기상 데이터 (온도, 풍속, 강수량 등) 결합

3. `fetch_firms_data.py`  
   → NASA FIRMS에서 한국 지역 위성 화재 데이터 (CSV) 다운로드

4. `augment_firms_improved.py`  
   → 각 화재 지점과 위성 화재 데이터를 거리/날짜 기준으로 매칭하여 병합

5. 결과 저장:  
   → `/public/data/korea_fire_full.json`

---

## 📦 최종 출력

```json
[
  {
    "frfr_sttmn_addr": "경상북도 영덕군 영덕읍",
    "frfr_frng_dtm": "2025-06-05 14:25",
    "frfr_lctn_xcrd": "129.3654",
    "frfr_lctn_ycrd": "36.4167",
    "temp": 27.1,
    "wspd": 3.5,
    "precip": 0.0,
    "brightness": 331.5,
    "frp": 10.1,
    "confidence": "n",
    "nasa_distance_km": 1.82
  },
  ...
]
```

→ 위 데이터는 `present.html`에서 지도 상 화재 시각화에 활용됩니다.

---

## 🛠 GitHub Actions 자동화

- 워크플로 파일: `.github/workflows/update_fire_data.yml`
- Secrets:
  - `METEOSTAT_KEY`
  - `WEATHERBIT_KEY`
  - `FIRMS_KEY`
- 트리거: `cron` 매일 01:00 (KST)

---

## 👨‍💻 작성자

- 자동화 설계: `2blackcow`
- 구현 기술: Python, GitHub Actions, Vercel, CesiumJS

---
