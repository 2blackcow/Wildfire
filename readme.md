# 🔥 Wildfire 3D Viewer

Photorealistic 3D 지도 위에 시계열 산불 이미지와 실시간 기상 데이터를 시각화하는 웹 기반 시스템입니다. NOAA/MAXAR 위성 화재 이미지, Meteostat API, Weatherbit API, Google 3D Tiles를 연동하여 LA 지역을 중심으로 시간 흐름에 따른 산불 발생과 기상 조건을 확인할 수 있습니다.

---

## ✅ 주요 기능

- **Photorealistic 3D City Tiles** 시각화 (Google Maps 3D Tiles API)
- **NOAA/MAXAR 시계열 화재 이미지 오버레이**
- **FIRMS 화재 지점 포인트 시각화**
  - 신뢰도에 따라 색상 구분: 높음 🔴 / 중간 🟠 / 낮음 🟡
  - 마우스 오버 시 InfoBox로 상세 정보 표시 (밝기, FRP, 위성 등)
- **Weatherbit + Meteostat API 연동**
  - 지도 클릭 시 해당 위치의 풍속, 풍향, 온도 등 기상정보 시각화
- **타임라인 슬라이더 + 자동 재생 기능**
- **.env + API 프록시 구성으로 보안 유지된 환경변수 처리**

---

## 📁 프로젝트 구조

```
├── public/
│   ├── index.html         # 전체 레이아웃 및 Cesium 뷰포트 구성
│   ├── main.js            # Cesium 렌더링 및 이벤트 로직
│   └── fire_archive_*.json # FIRMS 화재 지점 데이터
├── api/
│   ├── weatherbit.js      # Weatherbit API 프록시
│   ├── meteostat.js       # Meteostat API 프록시
│   └── config.js          # 환경변수 전달용 API
├── .env                   # 비공개 환경변수 설정 (배포 시 Git에 포함 X)
├── package.json           # 프로젝트 메타 정보 및 의존성
└── README.md              # 프로젝트 설명 문서
```

---

## 🌐 배포 주소

🔗 [https://wildfireviewer.vercel.app](https://wildfireviewer.vercel.app)

---

## 🔐 환경변수 (.env 또는 Vercel 환경설정)

| 환경변수 키             | 설명                                  |
|---------------------|-------------------------------------|
| `CESIUM_TOKEN`      | Cesium ion API 토큰                    |
| `GOOGLE_MAPS_KEY`   | Google Maps Photorealistic 3D Tiles 키  |
| `WEATHERBIT_KEY`    | Weatherbit 기상 정보 API 키              |
| `METEOSTAT_KEY`     | Meteostat 기상 정보 API 키              |

---

## ⚙️ 개발 및 배포 방법

### 로컬 개발

```bash
npm install
vercel dev
```

### 배포

- GitHub → Vercel 자동 연동
- `main` 브랜치 푸시 시 자동 배포됨
- 환경변수는 Vercel 설정에서 개별 등록 필요

📁 최신 예측 모델 구조 및 코드 설명

---

## 🔹 주요 코드 설명

### 1️⃣ `build_and_grid_train_data.py`
**역할:**
- FIRMS 화재 관측 데이터 + Meteostat 날씨 데이터 병합
- 각 화재지점에 대해 해당 날짜의 기상 정보를 API로 가져와 통합
- `fire_occurred = 1`, 주변 무작위 점 추가로 `fire_occurred = 0` 샘플 생성
- 위경도 좌표 → 격자(grid) ID로 변환 (예: `l_30_52`)
- 각 관측 지점이 속한 셀을 식별할 수 있도록 grid_id 부여

**주요 로직:**
- 셀 크기(`cell_size`) 기준으로 위경도 → 인덱스 계산
- `train_fire_data.csv`에 grid_id 컬럼 추가

**결과 파일:** `data/train_fire_data_grid_{REGION}.csv`

---

### 3️⃣ `prepare_grid_train_data.py`
**역할:**
- 문자열 격자 ID(`grid_id`) → 숫자 인코딩(`grid_id_encoded`)으로 변환
- temp, wspd, rhum, brightness, frp, confidence 등의 특성과 함께 학습셋 생성

**주요 로직:**
- `LabelEncoder`를 이용해 grid_id → 숫자 ID
- 필요한 특성 선택 및 `fire_occurred` 레이블 포함

**결과 파일:** `data/grid_encoded_train_data_{REGION}.csv`

---

### 4️⃣ `train_predict_grid_{REGION}.py`
**역할:**
- RandomForestClassifier로 화재 발생 예측 모델 학습
- 테스트셋에 대해 예측 확률 추론
- 시각화를 위한 날짜별 JSON 생성

**주요 로직:**
- 학습셋 로드 후 훈련/테스트 분할
- 예측 확률 저장 → `predicted_grid_fire_points_YYYYMMDD.json`
- 결과 파일은 `public/predicted/` 폴더로 복사됨
- 프론트에서 grid_id별 예측 시각화 가능

---

## ✅ 전체 흐름 요약

```bash
build_and_grid_train_data.py     # 기초 화재+날씨 데이터 병합, 위경도 → 격자 ID 변환
→ data/train_fire_data_grid_{REGION}.csv

prepare_grid_train_data.py       # grid_id 숫자화 + 특성 정제
→ data/grid_encoded_train_data_{REGION}.csv

train_predict_grid_{REGION}.py              # 모델 학습 & 예측 저장
→ public/predicted/predicted_grid_fire_points_{region_tag}_{date_tag}.json
```

---

## ⚙️ 실행 방법

### 1️⃣ 패키지 설치
```bash
pip install pandas numpy scikit-learn tqdm requests python-dotenv
```

### 2️⃣ 데이터 준비 및 전처리
```bash
python scripts/build_train_data.py
python scripts/create_grid_data.py
python scripts/prepare_grid_train_data.py
```

### 3️⃣ 머신러닝 예측 모델 학습
```bash
python scripts/train_grid_model.py
```
→ `public/predicted/` 폴더에 날짜별 예측 JSON 생성됨

### 4️⃣ 프론트엔드 3D 시각화 실행
```bash
vercel dev
```

---

## 🧠 기타 참고
- 모델은 각 날짜 기준 **D-1일까지의 데이터로 학습 → D일 예측**
- 예측 결과는 `grid_id` 중심으로 시각화됨 (육지 마스킹 적용됨)
- Turf.js + GeoJSON 기반으로 바다 위 예측 마커는 자동 제거됨
