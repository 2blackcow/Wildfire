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
