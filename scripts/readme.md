📁 최신 예측 모델 구조 및 코드 설명

---

## 🔹 주요 코드 설명

### 1️⃣ `build_train_data.py`
**역할:**
- FIRMS 화재 관측 데이터 + Meteostat 날씨 데이터 병합
- 각 화재지점에 대해 해당 날짜의 기상 정보를 API로 가져와 통합
- `fire_occurred = 1`, 주변 무작위 점 추가로 `fire_occurred = 0` 샘플 생성

**결과 파일:** `data/train_fire_data.csv`

---

### 2️⃣ `create_grid_data.py`
**역할:**
- 위경도 좌표 → 격자(grid) ID로 변환 (예: `l_30_52`)
- 각 관측 지점이 속한 셀을 식별할 수 있도록 grid_id 부여

**주요 로직:**
- 셀 크기(`cell_size`) 기준으로 위경도 → 인덱스 계산
- `train_fire_data.csv`에 grid_id 컬럼 추가

**결과 파일:** `data/train_fire_data_grid.csv`

---

### 3️⃣ `prepare_grid_train_data.py`
**역할:**
- 문자열 격자 ID(`grid_id`) → 숫자 인코딩(`grid_id_encoded`)으로 변환
- temp, wspd, rhum, brightness, frp, confidence 등의 특성과 함께 학습셋 생성

**주요 로직:**
- `LabelEncoder`를 이용해 grid_id → 숫자 ID
- 필요한 특성 선택 및 `fire_occurred` 레이블 포함

**결과 파일:** `data/grid_encoded_train_data.csv`

---

### 4️⃣ `train_grid_model.py`
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
build_train_data.py               # 기초 화재+날씨 데이터 병합
→ data/train_fire_data.csv

create_grid_data.py              # 위경도 → 격자 ID 변환
→ data/train_fire_data_grid.csv

prepare_grid_train_data.py       # grid_id 숫자화 + 특성 정제
→ data/grid_encoded_train_data.csv

train_grid_model.py              # 모델 학습 & 예측 저장
→ public/predicted/predicted_grid_fire_points_YYYYMMDD.json
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
