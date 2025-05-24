# 🔥 Wildfire 3D Viewer

Photorealistic 3D 지도 위에 시계열 산불 이미지와 실시간 공기질 데이터를 시각화하는 웹 기반 시스템입니다. NOAA/MAXAR 화재 이미지, IQAir API, Google 3D Tiles를 연동하여 LA 지역을 중심으로 시간 흐름에 따른 산불 발생과 대기 상태를 확인할 수 있습니다.

---

## ✅ 주요 기능

* **Photorealistic 3D City Tiles** 시각화 (Google Maps 3D Tiles API)
* **NOAA/MAXAR 시계열 화재 이미지 오버레이**
* **화재 지점 포인트 시각화**

  * 신뢰도에 따라 색상 구분: 높음 🔴 / 중간 🟠 / 낮음 🟡
  * 마우스 오버 시 InfoBox로 상세 정보 표시 (밝기, FRP, 위성명 등)
* **IQAir API 연동**

  * 지도 클릭 시 해당 좌표의 대기질 정보 요청
  * AQI, 풍속, 풍향, 온도 등 시각화
* **타임라인 슬라이더 + 자동 재생 기능**
* **.env + API 프록시 구성으로 보안 유지된 환경변수 처리**

---

## 📁 프로젝트 구조

```
├── public/
│   ├── index.html         # 전체 화면 레이아웃 및 Cesium 뷰포트
│   ├── main.js            # Cesium 렌더링 및 이벤트 처리
│   └── fire_archive_*.json # FIRMS 산불 데이터
├── api/
│   ├── air.js             # IQAir API 백엔드 프록시
│   └── config.js          # 환경변수 제공 API
├── .env                   # CESIUM_TOKEN, GOOGLE_MAPS_KEY, IQAIR_KEY (Git에 포함되지 않음)
├── package.json
└── README.md              # 프로젝트 개요 문서
```

---

## 🌐 배포 주소

🔗 [wildfireviewer.vercel.app](https://wildfireviewer.vercel.app)

---

## 🔐 환경변수 (.env 또는 Vercel 환경설정 필요)

| 키 이름              | 설명                     |
| ----------------- | ---------------------- |
| `CESIUM_TOKEN`    | Cesium ion API 토큰      |
| `GOOGLE_MAPS_KEY` | Google Maps 3D Tiles 키 |
| `IQAIR_KEY`       | IQAir 공기질 API 키        |

---

## ⚙️ 개발 및 배포 방법

> 정적 프론트엔드 기반으로 Vercel에서 배포합니다.

### 로컬 개발

```bash
npm install
vercel dev
```

### 배포

GitHub → Vercel 자동 연동 / `main` 브랜치 push 시 자동 배포됩니다.

---