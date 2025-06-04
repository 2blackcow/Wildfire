# 🔥 산불 예측 프로젝트 - `crawling` 폴더 작업 설명

## 📁 폴더 개요
`crawling/` 폴더는 **2024-10-01 ~ 2025-04-01 기간 동안의 산불 발생 정보 수집, 위경도 변환, 기상 데이터 및 NASA 데이터 병합**을 담당하는 스크립트를 포함합니다.

---

## 1️⃣ forest.py
산림청 산불발생정보 사이트에서 데이터를 크롤링하여 CSV 파일로 저장합니다.

- **크롤링 대상**:  
  - 발생일시, 진화일시, 발생지 주소, 진행상태, 대응단계  
- **설정**:  
  - 기간: 2024-10-01 ~ 2025-04-01  
  - 진행상태: `진화완료` 만 필터링  
  - 페이지 수 자동 계산 후 전체 페이지 반복 수집  
- **출력 파일**:  
  - `wildfire_all_2024_10_to_2025_04.csv`

---

## 2️⃣ geocode.py
주소 데이터를 위도/경도로 변환합니다 (카카오 주소 API 사용).

- **입력**: `wildfire_all_2024_10_to_2025_04.csv`
- **출력**: `wildfire_geocoded_2024_10_to_2025_04.csv`
- ✅ 예외처리 및 API 호출 실패 로그 포함  
- ✅ `.env`에서 `KAKAO_REST_API_KEY` 사용

---

## 3️⃣ meteostat.py
Meteostat API를 통해 각 위경도 좌표 및 날짜별 기온, 풍속, 풍향 정보를 가져와 병합합니다.

- **입력**: `wildfire_geocoded_2024_10_to_2025_04.csv`
- **출력**: `train_fire_data.csv`
- **가져오는 필드**:
  - 평균기온 (`평균기온 (temp)`)
  - 평균풍속 (`평균풍속 (wspd)`)
  - 풍향각도 (`풍향각도 (wdir)`)
- ✅ `.env`에서 `METEOSTAT_KEY` 사용

---

## 4️⃣ weatherbit.py
Weatherbit API를 통해 각 위경도 및 날짜에 해당하는 강수량 및 상대습도 데이터를 추가로 병합합니다.

- **입력**: `train_fire_data.csv`
- **출력**: `train_fire_data_with_weatherbit.csv`
- **가져오는 필드**:
  - 강수량 (`강수량 (precip)`)
  - 습도 (`습도 (rh)`)
- ✅ `.env`에서 `WEATHERBIT_KEY` 사용

---

## 5️⃣ merge_weatherbit_with_nasa_precise.py
NASA FIRMS 데이터를 기반으로, 날짜 ±3일 범위 내에서 **가장 가까운 위경도 지점 1개**를 찾아 `brightness`, `frp`, `confidence` 정보를 병합합니다.

- **입력**: `train_fire_data_with_weatherbit.csv` + `fire(2024-10-01~2025-04-01).csv`
- **출력**: `train_fire_data_precise_merged.csv`
- ✅ 한국 지역의 실제 관측 기반 화재 강도 정보 추가

---

## 📦 사용된 외부 서비스 및 API

| 서비스       | 사용 목적               | API KEY 위치                    |
|--------------|--------------------------|---------------------------------|
| 산림청 웹사이트 | 산불 목록 크롤링           | X (공개 페이지)                |
| Kakao Map    | 주소 → 위경도 변환         | `.env` → `KAKAO_REST_API_KEY` |
| Meteostat    | 기온/풍속/풍향 정보 획득   | `.env` → `METEOSTAT_KEY`      |
| Weatherbit   | 강수량/습도 정보 획득      | `.env` → `WEATHERBIT_KEY`     |
| NASA FIRMS   | 위성 기반 화재 강도 관측 정보 | X (CSV 직접 다운로드 활용)     |

---

## 📌 전체 데이터 처리 흐름 요약

1. `forest.py` → 산불 목록 CSV 저장  
2. `geocode.py` → 주소 → 위경도 변환  
3. `meteostat.py` → 기상 정보 1차 병합  
4. `weatherbit.py` → 강수량/습도 정보 추가  
5. `merge_weatherbit_with_nasa_precise.py` → NASA 위성 화재 정보 병합  
6. ✅ 최종 데이터: `train_fire_data_precise_merged.csv`

---

## 🔍 예측 모델에서의 활용

이렇게 병합된 데이터는 **산불 발생 여부를 예측**하는 머신러닝 모델의 학습에 사용됩니다.

### Feature 구성
- **위치 정보**: 위도, 경도
- **기상 정보**: 기온, 풍속, 풍향, 강수량, 습도
- **위성 정보**: 밝기 (`brightness`), 방사 강도 (`frp`), 신뢰도 (`confidence`)

### 예측 타깃
- `fire_occurred = 1`: 실제 화재 지점  
- `fire_occurred = 0`: 무작위 비화재 샘플 (데이터 증강)

### 예측 모델 예시
- `RandomForest`, `XGBoost`, `LightGBM` 등 구조화 데이터 기반 모델  
- 딥러닝 또는 시계열 모델로 확장 가능

---

## ✅ 최종 정리

> 한국 산불 정보 + 기상 변수 + NASA FIRMS 위성 화재 데이터를 종합하여 생성한  
> **`train_fire_data_precise_merged.csv`** 는 예측 모델 학습에 바로 사용 가능한 최종 데이터입니다.
