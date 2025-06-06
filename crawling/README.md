# 🔥 Fire Data Automation System (crawling/)

본 시스템은 대한민국 산불 정보를 실시간으로 수집하고, 기상 및 위성 데이터와 통합하여
최종 시각화에 사용할 수 있는 JSON 파일을 매일 자동으로 생성합니다.

---

## 📁 폴더 구조 개요

```
crawling/
├── fetch_forest_data.py                    # 산림청 산불발생정보 크롤링 (실시간)
├── augment_weather.py                      # Meteostat, Weatherbit 기상 정보 병합
├── fetch_firms_data.py                     # NASA FIRMS 위성 화재 데이터 다운로드 (실시간)
├── augment_firms_improved.py               # NASA + 화재 데이터 최종 병합 (매칭 최적화)
├── fetch_historical_fire_data.py           # 과거 산불 데이터 수집 (2024-10-01 ~ 2025-04-01)
├── add_weather_to_historical_data.py       # 과거 화재 데이터에 기상 정보 추가
├── fetch_nasa_firms_historical.py          # 과거 NASA FIRMS 데이터 수집
├── merge_historical_nasa_data.py           # 과거 화재+기상+NASA 데이터 통합
├── update_archive_nasa_data.py             # NASA 아카이브 데이터와 기존 화재 데이터 추가 통합
├── README.md                               # ← 본 문서
```

---

## ⚙️ 자동화 시스템 구성

### 🔄 실시간 데이터 파이프라인 (매일 자동 실행)

GitHub Actions에서 `update_fire_data.yml`을 통해 매일 새벽 1시 자동 실행됩니다.

**실행 순서:**

1. `fetch_forest_data.py`  
   → 산림청 사이트에서 최근 7일간 화재 발생지 위경도 수집

2. `augment_weather.py`  
   → 각 화재 지점에 대한 과거 기상 데이터 (온도, 풍속, 강수량 등) 결합

3. `fetch_firms_data.py`  
   → NASA FIRMS에서 한국 지역 위성 화재 데이터 (CSV) 다운로드

4. `augment_firms_improved.py`  
   → 각 화재 지점과 위성 화재 데이터를 거리/날짜 기준으로 매칭하여 병합

5. **결과 저장:**  
   → `/public/data/korea_fire_full.json`

### 📊 과거 데이터 구축 파이프라인 (일회성)

**2024-10-01 ~ 2025-04-01 기간 통합 데이터셋 구축:**

1. `fetch_historical_fire_data.py`  
   → 산림청 API에서 지정 기간 모든 화재 데이터 수집 (312건)
   → 출력: `korea_fire_2024_2025.json`

2. `add_weather_to_historical_data.py`  
   → 각 화재 지점별 발생일 기상 데이터 수집 및 결합
   → 출력: `korea_fire_2024_2025_with_weather.json`

3. `fetch_nasa_firms_historical.py`  
   → NASA FIRMS에서 동일 기간 위성 관측 데이터 수집 (223건)
   → 10일 단위로 나누어 API 제한 회피
   → 출력: `nasa_firms_korea_2024_2025.json`

4. `merge_historical_nasa_data.py`  
   → 화재 위치와 NASA 위성 데이터 매칭 (거리 ≤50km, 날짜 차이 ≤3일)
   → 매칭률: 15.7% (49/312건)
   → 출력: `korea_fire_full_2024_2025.json`

5. `update_archive_nasa_data.py`  
   → NASA FIRMS 아카이브 데이터(3,031건)와 기존 화재 데이터 추가 통합
   → NASA 데이터 없던 263개 화재 중 57개 신규 매칭
   → 최종 매칭률: 34.0% (106/312건)
   → 출력: `korea_fire_enhanced_2024_2025.json`

---

## 📦 최종 출력 데이터

### 실시간 데이터
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
  }
]
```

### 과거 데이터 (Enhanced)
```json
[
  {
    "frfr_info_id": "366044",
    "occu_dtm": "20250331143000",
    "addr": "인천광역시 옹진군 영흥면",
    "frfr_lctn_ycrd": 37.7816,
    "frfr_lctn_xcrd": 126.8542,
    "temp": 15.2,
    "wspd": 4.1,
    "wdir": 230,
    "precip": 0.0,
    "rhum": 45,
    "brightness": 301.71,
    "frp": 8.5,
    "confidence": "n",
    "satellite": "N",
    "nasa_distance_km": 37.97,
    "nasa_match_threshold": 50.0,
    "bright_t31": 295.64,
    "nasa_acq_time": 446,
    "nasa_daynight": "D"
  }
]
```

---

## 🛠 GitHub Actions 자동화

- **워크플로 파일**: `.github/workflows/update_fire_data.yml`
- **환경 변수 (Secrets)**:
  - `METEOSTAT_KEY`: 기상 데이터 API 키
  - `WEATHERBIT_KEY`: 기상 데이터 API 키  
  - `FIRMS_KEY`: NASA FIRMS API 키
- **트리거**: `cron` 매일 01:00 (KST)
- **배포**: Vercel 자동 배포 연동

---

## 🔄 데이터 품질 개선 과정

### Phase 1: 기본 통합 (15.7% 매칭률)
- NASA FIRMS API: 223개 데이터
- 매칭 결과: 49/312개 화재

### Phase 2: 아카이브 통합 (34.0% 매칭률)
- NASA FIRMS Archive: 3,031개 데이터 (13배 증가)
- 추가 매칭: 57개 화재
- 최종 결과: 106/312개 화재

### 품질 향상 효과
```
매칭률: 15.7% → 34.0% (2.2배 향상)
정밀 데이터: 12개 → 26개 (20km 이내)
고품질 피처: 49개 → 106개 (훈련 데이터 2배)
```

---

## 📈 성과 요약

### 데이터 수집 성과
- ✅ **실시간 시스템**: 매일 자동 화재 데이터 수집
- ✅ **과거 데이터**: 312개 화재 사례 (6개월간)
- ✅ **통합 데이터**: 화재 + 기상 + 위성 데이터 결합

### 품질 향상 성과
- ✅ **매칭률 개선**: 15.7% → 34.0% (2.2배 향상)
- ✅ **정밀 데이터**: 20km 이내 26개 화재 매칭
- ✅ **예측 모델 준비**: 106개 고품질 훈련 데이터 확보

---

## 👨‍💻 작성자

- **자동화 설계**: `2blackcow`
- **구현 기술**: Python, GitHub Actions, Vercel, CesiumJS
- **데이터 소스**: 산림청, NASA FIRMS, Meteostat, Weatherbit