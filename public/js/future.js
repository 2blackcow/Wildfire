let viewer;
let region = "la"; // "la" or "korea"
let fireData_la = [];
let fireData_korea = [];
let fireEntities = [];
let predictedEntities = [];
let gridPolygonEntities = []; // [추가] 격자 셀 폴리곤 엔티티 리스트
let landGeoJson = null;
let isPlaying = false;
let playInterval = null;
let isGridVisible = false; // [수정] 격자 초기값 OFF

const laDates = [
  "2025-01-08", "2025-01-09", "2025-01-10", "2025-01-13",
  "2025-01-14", "2025-01-16", "2025-01-18", "2025-01-20",
];

const koreaPredictDatesRaw = [
  "20241107", "20241110", "20241111", "20241115", "20241118", "20241119",
  "20241122", "20241124", "20241204", "20241209", "20241210", "20241212",
  "20241214", "20241215", "20241219", "20241224", "20241226", "20241229",
  "20241230", "20241231", "20250101", "20250102", "20250103", "20250104",
  "20250110", "20250111", "20250112", "20250119", "20250123", "20250124",
  "20250125", "20250126", "20250308", "20250309", "20250310", "20250311",
  "20250313", "20250317", "20250318", "20250320", "20250321", "20250322",
  "20250323", "20250327", "20250329", "20250330", "20250331"
];
const koreaPredictDates = koreaPredictDatesRaw.map(s => 
  `${s.substr(0,4)}-${s.substr(4,2)}-${s.substr(6,2)}`
);

let currentIndex = 0;

function getActiveDateList() {
  return (region === "la") ? laDates : koreaPredictDates;
}
function getActiveDate(idx) {
  return getActiveDateList()[idx];
}

// ====== 육지/바다 =====
fetch("land.geojson")
  .then(res => res.json())
  .then(data => { landGeoJson = data; });

// ====== 관측/예측 토글 =====
let isActualVisible = true;  // [유지] 관측 화점 초기값 ON
let isPredVisible = false;   // [수정] 예측 화점 초기값 OFF
document.getElementById("toggleActualBtn").addEventListener("click", () => {
  isActualVisible = !isActualVisible;
  fireEntities.forEach(e => e.show = isActualVisible);
  document.getElementById("toggleActualBtn").textContent =
    isActualVisible ? "🔥 관측 화점 OFF" : "🔥 관측 화점 ON";
});
document.getElementById("togglePredBtn").addEventListener("click", () => {
  isPredVisible = !isPredVisible;
  predictedEntities.forEach(e => e.show = isPredVisible
  );
  document.getElementById("togglePredBtn").textContent =
    isPredVisible ? "🤖 AI 예측 화점 OFF" : "🤖 AI 예측 화점 ON";
});
// [추가] 격자(폴리곤) on/off 토글
document.getElementById("toggleGridBtn").addEventListener("click", () => {
  isGridVisible = !isGridVisible;
  gridPolygonEntities.forEach(e => e.show = isGridVisible);
  document.getElementById("toggleGridBtn").textContent =
    isGridVisible ? "🟨 격자 OFF" : "🟨 격자 ON";
});

// ====== 날짜 드롭다운 동적 세팅 =====
function populateDateSelect() {
  const select = document.getElementById('fireDateSelect');
  select.innerHTML = "";
  getActiveDateList().forEach((date, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.text = date;
    select.appendChild(opt);
  });
  // 슬라이더도 max/min 세팅
  const slider = document.getElementById('timeSlider');
  slider.min = 0;
  slider.max = getActiveDateList().length - 1;
  slider.value = 0;
}

function updateDateLabel(idx) {
  document.getElementById("dateLabel").textContent = `🗓️ ${getActiveDate(idx)}`;
}

function updateFiresForDate(selectedDate) {
  const fireInfo = document.getElementById("fireInfo");
  fireEntities.forEach(e => viewer.entities.remove(e));
  fireEntities.length = 0;

  let data = (region === "la") ? fireData_la : fireData_korea;
  let fireCount = 0;

  data.forEach((fire) => {
    if (region === "korea") {
      // ---- 국내 JSON 구조 맞춤 파싱 ----
      const acqDate = fire.frfr_sttmn_dt ? `${fire.frfr_sttmn_dt.slice(0,4)}-${fire.frfr_sttmn_dt.slice(4,6)}-${fire.frfr_sttmn_dt.slice(6,8)}` : null;
      if (acqDate !== selectedDate) return;
      const lat = parseFloat(fire.frfr_lctn_ycrd);
      const lon = parseFloat(fire.frfr_lctn_xcrd);
      // null이면 스킵
      if (!lat || !lon) return;

      const entity = viewer.entities.add({
        id: `fire-korea-${lat}-${lon}-${acqDate}`,
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 10),
        point: {
          pixelSize: 12,
          color: Cesium.Color.ORANGE.withAlpha(0.78),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `
          <b>관측일자:</b> ${acqDate}<br/>
          <b>주소:</b> ${fire.frfr_sttmn_addr || "-"}<br/>
          <b>진행상태:</b> ${fire.frfr_prgrs_stcd_str || "-"}
        `,
      });
      entity.show = isActualVisible;
      fireEntities.push(entity);
      fireCount++;
    } else {
      // ---- LA 관측데이터 기존 방식 ----
      const acqDate = fire.acq_date || fire.date;
      if (acqDate !== selectedDate) return;
      let color = Cesium.Color.YELLOW.withAlpha(0.7);
      if (fire.confidence === "h") color = Cesium.Color.RED.withAlpha(0.8);
      else if (fire.confidence === "n") color = Cesium.Color.ORANGE.withAlpha(0.8);
      const frp = parseFloat(fire.frp);
      const size = Math.min(Math.max(frp / 8, 8), 20);
      const lat = fire.latitude + (Math.random() - 0.5) * 0.015;
      const lon = fire.longitude + (Math.random() - 0.5) * 0.015;
      const entity = viewer.entities.add({
        id: `fire-la-${lat}-${lon}-${acqDate}`,
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 10),
        point: {
          pixelSize: size,
          color: color,
          scaleByDistance: new Cesium.NearFarScalar(1000.0, 2.0, 2000000.0, 0.5),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `
          <b>관측일자:</b> ${acqDate}<br/>
          <b>밝기:</b> ${fire.brightness}<br/>
          <b>FRP:</b> ${fire.frp}<br/>
          <b>화재 신뢰도:</b> ${fire.confidence === "h" ? "높음" : fire.confidence === "n" ? "중간" : "낮음"}
        `,
      });
      entity.show = isActualVisible;
      fireEntities.push(entity);
      fireCount++;
    }
  });
  if (fireInfo) fireInfo.textContent = `🔥 ${selectedDate} 화재 지점 ${fireCount}개 시각화됨`;
}

// ====== 예측 격자 폴리곤/마커 =====
function gridIdToLatLon(grid_id, region) {
  const parts = grid_id.split("_");
  const lat_idx = parseInt(parts[1]);
  const lon_idx = parseInt(parts[2]);
  if (region === "korea") {
    const min_lat = 34.0, min_lon = 126.0, cell_size = 0.05;
    return {
      lat: min_lat + (lat_idx + 0.5) * cell_size,
      lon: min_lon + (lon_idx + 0.5) * cell_size
    };
  } else {
    const min_lat = 33.5, min_lon = -119.0, cell_size = 0.05;
    return {
      lat: min_lat + (lat_idx + 0.5) * cell_size,
      lon: min_lon + (lon_idx + 0.5) * cell_size
    };
  }
}
function gridIdToPolygonDegrees(grid_id, region) {
  const parts = grid_id.split("_");
  const lat_idx = parseInt(parts[1]);
  const lon_idx = parseInt(parts[2]);
  let min_lat, min_lon, cell_size;
  if (region === "korea") {
    min_lat = 34.0;
    min_lon = 126.0;
    cell_size = 0.05;
  } else {
    min_lat = 33.5;
    min_lon = -119.0;
    cell_size = 0.05;
  }
  const sw = [min_lon + lon_idx * cell_size, min_lat + lat_idx * cell_size];
  const nw = [sw[0], sw[1] + cell_size];
  const ne = [sw[0] + cell_size, sw[1] + cell_size];
  const se = [sw[0] + cell_size, sw[1]];
  // [lon, lat] 순
  return [...sw, ...nw, ...ne, ...se];
}
function isLand(lat, lon) {
  if (!landGeoJson) return true;
  const pt = turf.point([lon, lat]);
  for (const feature of landGeoJson.features) {
    if (turf.booleanPointInPolygon(pt, feature)) return true;
  }
  return false;
}
function loadPredictedFirePointsForDate(dateStr) {
  let fileName;
  if (region === "la") {
    fileName = `predicted/predicted_grid_fire_points_${dateStr.replaceAll("-", "")}.json`;
  } else {
    fileName = `predicted/korea/predicted_grid_fire_points_korea_${dateStr.replaceAll("-", "")}.json`;
  }

  // 기존 마커/폴리곤 제거
  predictedEntities.forEach(e => viewer.entities.remove(e));
  predictedEntities = [];
  gridPolygonEntities.forEach(e => viewer.entities.remove(e));
  gridPolygonEntities = [];

  fetch(fileName)
    .then((res) => { if (!res.ok) throw new Error(`JSON 불러오기 실패: ${fileName}`); return res.json(); })
    .then((data) => {
      if (!data || !Array.isArray(data)) return;

      // ① [중복 방지용] grid_id Set 생성!
      const gridIdSet = new Set();

      data.forEach((pt) => {
        if (!pt.grid_id) return;

        // ② 이미 추가된 grid_id면 패스!
        if (gridIdSet.has(pt.grid_id)) return;
        gridIdSet.add(pt.grid_id);

        const { lat, lon } = gridIdToLatLon(pt.grid_id, region);
        if (!isLand(lat, lon)) return;

        // [옵션] 예측확률에 따라 색상 유도리 (형광+빨강 계열)
        let color;
        if (pt.probability > 0.8) color = Cesium.Color.RED.withAlpha(0.4);
        else if (pt.probability > 0.5) color = Cesium.Color.ORANGE.withAlpha(0.4);
        else color = Cesium.Color.YELLOW.withAlpha(0.4);

        // [폴리곤] - 그리드 셀 면적
        const polyDegrees = gridIdToPolygonDegrees(pt.grid_id, region);
        const polyEntity = viewer.entities.add({
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(polyDegrees),
            material: color,
            outline: true,
            outlineColor: Cesium.Color.LIME.withAlpha(0.6),
            outlineWidth: 2,
            classificationType: Cesium.ClassificationType.BOTH
          },
          description: `📦 <b>격자번호:</b> ${pt.grid_id}<br/>🎯 <b>예측 확률:</b> ${(pt.probability * 100).toFixed(1)}%`
        });
        polyEntity.show = isGridVisible;
        gridPolygonEntities.push(polyEntity);

        // [점 마커도 같이]
        const entity = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          point: {
            pixelSize: 5 + 5 * pt.probability,
            color: Cesium.Color.CHARTREUSE.withAlpha(Math.max(0.4, pt.probability)),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          description: `🔥 <b>격자번호:</b> ${pt.grid_id}<br/>🎯 <b>예측 확률:</b> ${(pt.probability * 100).toFixed(1)}%`
        });
        entity.show = isPredVisible;
        predictedEntities.push(entity);
      });
      console.log(`✅ 예측 격자 폴리곤 ${gridPolygonEntities.length}개 시각화`);
    })
    .catch((err) => {
      console.error("❌ 예측 데이터 불러오기 실패:", err);
    });
}


// ====== region 전환 ======
function updateRegionButtonText() {
  const btn = document.getElementById("toggleRegionBtn");
  btn.textContent = (region === "la") ? "🌏 국내 예측 보기" : "🌎 LA 예측 보기";
}
document.getElementById("toggleRegionBtn").addEventListener("click", () => {
  region = region === "la" ? "korea" : "la";
  updateRegionButtonText();
  if (region === "la") {
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(-118.60, 34.1, 170000) });
  } else {
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(127.7669, 35.9078, 1200000.0) });
  }
  populateDateSelect();
  currentIndex = 0;
  updateDateLabel(0);
  updateFiresForDate(getActiveDate(0));
  loadPredictedFirePointsForDate(getActiveDate(0));
});

document.getElementById("playBtn").addEventListener("click", () => {
  if (!isPlaying) {
    isPlaying = true;
    document.getElementById("playBtn").textContent = "⏸️ 일시정지";
    playInterval = setInterval(() => {
      if (currentIndex < getActiveDateList().length - 1) {
        currentIndex++;
        document.getElementById("timeSlider").value = currentIndex;
        document.getElementById("fireDateSelect").value = currentIndex;
        updateDateLabel(currentIndex);
        updateFiresForDate(getActiveDate(currentIndex));
        loadPredictedFirePointsForDate(getActiveDate(currentIndex));
      } else {
        clearInterval(playInterval);
        isPlaying = false;
        document.getElementById("playBtn").textContent = "▶️ 재생";
      }
    }, 2000);
  } else {
    isPlaying = false;
    document.getElementById("playBtn").textContent = "▶️ 재생";
    clearInterval(playInterval);
  }
});

document.getElementById("fireDateSelect").addEventListener("change", (e) => {
  currentIndex = parseInt(e.target.value);
  document.getElementById("timeSlider").value = currentIndex;
  updateDateLabel(currentIndex);
  updateFiresForDate(getActiveDate(currentIndex));
  loadPredictedFirePointsForDate(getActiveDate(currentIndex));
});
document.getElementById("timeSlider").addEventListener("input", (e) => {
  currentIndex = parseInt(e.target.value);
  document.getElementById("fireDateSelect").value = currentIndex;
  updateDateLabel(currentIndex);
  updateFiresForDate(getActiveDate(currentIndex));
  loadPredictedFirePointsForDate(getActiveDate(currentIndex));
});

// ====== INIT ======
async function init() {
  viewer = new Cesium.Viewer("cesiumContainer", {
    geocoder: true,
    baseLayerPicker: true,
    sceneModePicker: true,
    timeline: false,
    animation: false,
  });
  viewer.scene.skyAtmosphere.show = true;
  try {
    const tileset = await Cesium.createGooglePhotorealistic3DTileset();
    viewer.scene.primitives.add(tileset);
  } catch (error) {
    console.error("🧨 3D 타일셋 생성 실패", error);
  }
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-118.60, 34.1, 150000),
  });
  updateRegionButtonText();
  populateDateSelect();
  updateDateLabel(0);
  updateFiresForDate(getActiveDate(0));
  loadPredictedFirePointsForDate(getActiveDate(0));
}

// ====== 관측 데이터, API KEY, init ======
Promise.all([
  fetch("/api/config").then(res => res.json()),
  fetch("fire_archive_SV-C2_616504.json").then(res => res.json()), // LA
  fetch("data/korea_fire_enhanced_2024_2025.json").then(res => res.json()), // 국내 관측
]).then(([config, la, korea]) => {
  Cesium.Ion.defaultAccessToken = config.cesiumToken;
  Cesium.GoogleMaps.defaultApiKey = config.googleKey;
  fireData_la = la;
  fireData_korea = korea;
  init();
}).catch((error) => {
  console.error("🔥 초기화 실패:", error);
});