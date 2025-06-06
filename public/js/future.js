let viewer;
let region = "la"; // "la" 또는 "korea"
let fireData_la = [];
let fireData_korea = [];
let fireEntities = [];
let predictedEntities = [];
let landGeoJson = null;

// 날짜 인덱스 <-> 실제 날짜 맵핑
const dateIndexMap = {
  0: "2025-01-08",
  1: "2025-01-09",
  2: "2025-01-10",
  3: "2025-01-13",
  4: "2025-01-14",
  5: "2025-01-16",
  6: "2025-01-18",
  7: "2025-01-20",
};

// ===== [1] GeoJSON 육지/바다 =====
fetch("land.geojson")
  .then(res => res.json())
  .then(data => { landGeoJson = data; });

// ===== [2] 실제/예측 마커 ON/OFF 토글 =====
let isActualVisible = true;
let isPredVisible = true;
document.getElementById("toggleActualBtn").addEventListener("click", () => {
  isActualVisible = !isActualVisible;
  fireEntities.forEach(e => e.show = isActualVisible);
  document.getElementById("toggleActualBtn").textContent =
    isActualVisible ? "🔥 관측 화점 OFF" : "🔥 관측 화점 ON";
});
document.getElementById("togglePredBtn").addEventListener("click", () => {
  isPredVisible = !isPredVisible;
  predictedEntities.forEach(e => e.show = isPredVisible);
  document.getElementById("togglePredBtn").textContent =
    isPredVisible ? "🤖 AI 예측 화점 OFF" : "🤖 AI 예측 화점 ON";
});

// ===== [3] 국내/LA 전환 버튼 =====
function setControlVisibility() {
  const controls = document.getElementById('controlsContainer');
  const dateLabel = document.getElementById('dateLabel');
  controls.style.display = (region === "la") ? "block" : "none";
  dateLabel.style.display = (region === "la") ? "block" : "none";
}

// region 변경될 때마다 호출!
document.getElementById("toggleRegionBtn").addEventListener("click", () => {
  region = region === "la" ? "korea" : "la";
  const btn = document.getElementById("toggleRegionBtn");
  if (region === "la") {
    btn.textContent = "🌏 국내 예측 보기";
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(-118.60, 34.1, 150000) });
  } else {
    btn.textContent = "🌎 LA 예측 보기";
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(127.7669, 35.9078, 600000.0) });
  }
  setControlVisibility();
  updateLayers(currentIndex);
  updateDateLabel(currentIndex);
  updateFiresForDate(dateIndexMap[currentIndex]);
  loadPredictedFirePointsForDate(dateIndexMap[currentIndex]);
});

// 최초 1회만 초기화 시점에도 호출!
setControlVisibility();


// ===== [4] 날짜별 관측/예측 마커 그리기 =====
function updateFiresForDate(selectedDate) {
  const fireInfo = document.getElementById("fireInfo");
  fireEntities.forEach(e => viewer.entities.remove(e));
  fireEntities.length = 0;

  let data = (region === "la") ? fireData_la : fireData_korea;
  let fireCount = 0;

  data.forEach((fire) => {
    if (fire.acq_date !== selectedDate) return;

    let color = Cesium.Color.YELLOW.withAlpha(0.7);
    if (fire.confidence === "h") color = Cesium.Color.RED.withAlpha(0.8);
    else if (fire.confidence === "n") color = Cesium.Color.ORANGE.withAlpha(0.8);

    const frp = parseFloat(fire.frp);
    const size = Math.min(Math.max(frp / 8, 8), 20);

    // ✅ 오프셋 (시각화 분산용)
    const lat = fire.latitude + (Math.random() - 0.5) * 0.015;
    const lon = fire.longitude + (Math.random() - 0.5) * 0.015;
    const height = 10;

    const entity = viewer.entities.add({
      id: `fire-${lat}-${lon}-${fire.acq_date}`,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      point: {
        pixelSize: size,
        color: color,
        scaleByDistance: new Cesium.NearFarScalar(1000.0, 2.0, 2000000.0, 0.5),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      description: `
        <b>관측일자:</b> ${fire.acq_date}<br/>
        <b>밝기:</b> ${fire.brightness}<br/>
        <b>FRP:</b> ${fire.frp}<br/>
        <b>화재 신뢰도:</b> ${fire.confidence === "h" ? "높음" : fire.confidence === "n" ? "중간" : "낮음"}
      `,
    });
    entity.show = isActualVisible;

    fireEntities.push(entity);
    fireCount++;
  });

  if (fireInfo) fireInfo.textContent = `🔥 ${selectedDate} 화재 지점 ${fireCount}개 시각화됨`;
}

// ===== [5] 예측 마커(격자) 로딩 =====
const min_lat = 33.5, min_lon = -119.0, cell_size = 0.05;
function gridIdToLatLon(grid_id) {
  const parts = grid_id.split("_");
  const lat_idx = parseInt(parts[1]);
  const lon_idx = parseInt(parts[2]);
  const lat = min_lat + (lat_idx + 0.5) * cell_size;
  const lon = min_lon + (lon_idx + 0.5) * cell_size;
  return { lat, lon };
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
  const base = (region === "la") ? "predicted" : "predicted_korea";
  const fileName = `${base}/predicted_grid_fire_points_${dateStr.replaceAll("-", "")}.json`;

  fetch(fileName)
    .then((res) => { if (!res.ok) throw new Error(`JSON 불러오기 실패: ${fileName}`); return res.json(); })
    .then((data) => {
      predictedEntities.forEach(e => viewer.entities.remove(e));
      predictedEntities = [];

      data.forEach((pt) => {
        const { lat, lon } = gridIdToLatLon(pt.grid_id);
        if (!isLand(lat, lon)) return;
        const color = Cesium.Color.CHARTREUSE.withAlpha(Math.max(0.4, pt.probability));
        const size = 5 + 5 * pt.probability;
        const entity = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          point: {
            pixelSize: size,
            color: color,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          description: `🔥 <b>격자번호:</b> ${pt.grid_id}<br/>🎯 <b>예측 확률:</b> ${(pt.probability * 100).toFixed(1)}%`
        });
        entity.show = isPredVisible;
        predictedEntities.push(entity);
      });
      console.log(`✅ 예측 확률 마커 ${data.length}개 표시`);
    })
    .catch((err) => {
      console.error("❌ 예측 데이터 불러오기 실패:", err);
    });
}

// ===== [6] 레이어, 슬라이더 등 past.html과 동일하게 =====
const layerIds = [
  "20250108m-maxar", "20250109m-maxar", "20250110n-maxar", "20250113m-maxar",
  "20250114m-maxar", "20250116m-maxar", "20250118m-maxar", "20250120m-maxar",
];
const layerLabels = [
  "2025-01-08", "2025-01-09", "2025-01-10", "2025-01-13",
  "2025-01-14", "2025-01-16", "2025-01-18", "2025-01-20",
];
const layerObjects = [];
function updateLayers(index) {
  layerObjects.forEach((layer, idx) => {
    layer.show = idx === index;
    layer.alpha = idx === index ? (idx === 0 ? 1.0 : 0.7) : 0.0;
  });
}
function updateDateLabel(index) {
  document.getElementById("dateLabel").textContent = `🗓️ ${layerLabels[index]}`;
}

// ===== [7] init =====
let currentIndex = 0;
let isPlaying = false;
let sliderInterval = null;

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

  // Imagery Layer
  for (let i = 0; i < layerIds.length; i++) {
    const provider = new Cesium.UrlTemplateImageryProvider({
      url: `https://stormscdn.ngs.noaa.gov/${layerIds[i]}/{z}/{x}/{y}`,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      maximumLevel: 19,
      credit: `NOAA MAXAR ${layerIds[i]}`,
    });
    const layer = viewer.imageryLayers.addImageryProvider(provider);
    layer.alpha = 0.7;
    layer.show = false;
    layerObjects.push(layer);
  }

  // 지도 클릭 환경 데이터
  const weatherInfo = document.getElementById("weatherInfo");
  const windArrow = document.getElementById("windArrow");
  let currentEntity = null;
  let lastClickTime = 0;
  viewer.screenSpaceEventHandler.setInputAction((click) => {
    const now = Date.now();
    if (now - lastClickTime < 5000) return;
    lastClickTime = now;
    const picked = viewer.scene.pickPosition(click.position);
    if (!picked) return;
    const carto = Cesium.Cartographic.fromCartesian(picked);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const lon = Cesium.Math.toDegrees(carto.longitude);

    if (currentEntity) viewer.entities.remove(currentEntity);
    currentEntity = viewer.entities.add({
      id: "clicked-point",
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: { pixelSize: 14, color: Cesium.Color.CYAN, outlineColor: Cesium.Color.BLUE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new Cesium.NearFarScalar(100, 1.2, 10000, 0.5), },
    });

    // 📍 현재 선택된 날짜 index → 실제 날짜로 변환
    const selectedIndex = parseInt(document.getElementById("timeSlider").value);
    const selectedDate = dateIndexMap[selectedIndex];
    const start = selectedDate;
    const end = new Date(new Date(selectedDate).getTime() + 86400000).toISOString().slice(0, 10);

    weatherInfo.innerHTML = `
      📍 위도: ${lat.toFixed(4)}<br/>
      📍 경도: ${lon.toFixed(4)}<br/>
      <span style="color:gray">🌫️ 공기질 데이터를 불러오는 중...</span>
    `;
    function getAqiColor(aqi) {
      if (aqi <= 50) return "#00e400";
      if (aqi <= 100) return "#ffff00";
      if (aqi <= 150) return "#ff7e00";
      if (aqi <= 200) return "#ff0000";
      if (aqi <= 300) return "#8f3f97";
      return "#7e0023";
    }
    Promise.all([
      fetch(`/api/airquality?lat=${lat}&lon=${lon}&start=${start}&end=${end}`).then((res) => res.json()),
      fetch(`/api/meteostat?lat=${lat}&lon=${lon}&start=${start}&end=${end}`).then((res) => res.json()),
    ]).then(([airData, weatherData]) => {
      const aqi = airData?.data?.[0]?.aqi ?? null;
      const o3 = airData?.data?.[0]?.o3 ?? "-";
      const ws = weatherData?.data?.[0]?.wspd ?? "-";
      const wd = weatherData?.data?.[0]?.wdir ?? "-";
      const temp = weatherData?.data?.[0]?.temp ?? "-";
      const rh = weatherData?.data?.[0]?.rhum ?? "-";
      const prcp = weatherData?.data?.[0]?.prcp ?? "-";
      const dew = weatherData?.data?.[0]?.dwpt ?? "-";
      const aqiColor = aqi !== null ? getAqiColor(aqi) : "#aaa";
      weatherInfo.innerHTML = `
        📍 위도: ${lat.toFixed(4)}<br/>
        📍 경도: ${lon.toFixed(4)}<br/>
        🌫️ AQI: <b style="color:${aqiColor}">${aqi ?? "데이터 없음"}</b><br/>
        🌬️ 오존(O₃): ${o3} ppb<br/>
        🌡️ 기온: ${temp}°C<br/>
        💧 습도: ${rh}%<br/>
        ❄️ 이슬점: ${dew}°C<br/>
        ☔ 강수량: ${prcp} mm<br/>
        🌫️ 풍속: ${ws} m/s<br/>
        🧭 풍향: ${wd}°
      `;
      if (!isNaN(parseFloat(wd))) windArrow.style.transform = `rotate(${wd}deg)`;
    }).catch((err) => {
      weatherInfo.innerHTML = `📍 위도: ${lat.toFixed(4)}<br/>📍 경도: ${lon.toFixed(4)}<br/>❌ 날씨 데이터 불러오기 실패`;
    });
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // 마우스 오버 시 fire info 팝업
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement) => {
    const pickedObject = viewer.scene.pick(movement.endPosition);
    if (Cesium.defined(pickedObject) && pickedObject.id?.description) {
      viewer.selectedEntity = pickedObject.id;
    } else {
      viewer.selectedEntity = null;
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // 슬라이더/드롭다운/재생버튼
  document.getElementById("fireDateSelect").addEventListener("change", () => {
    const idx = parseInt(document.getElementById("fireDateSelect").value);
    document.getElementById("timeSlider").value = idx;
    updateLayers(idx); updateDateLabel(idx);
    updateFiresForDate(dateIndexMap[idx]); loadPredictedFirePointsForDate(dateIndexMap[idx]);
    currentIndex = idx;
  });
  document.getElementById("timeSlider").addEventListener("input", () => {
    const idx = parseInt(document.getElementById("timeSlider").value);
    document.getElementById("fireDateSelect").value = idx;
    updateLayers(idx); updateDateLabel(idx);
    updateFiresForDate(dateIndexMap[idx]); loadPredictedFirePointsForDate(dateIndexMap[idx]);
    currentIndex = idx;
  });

  document.getElementById("toggleButton").addEventListener("click", () => {
    isPlaying = !isPlaying;
    document.getElementById("toggleButton").textContent = isPlaying ? "⏸ 일시정지" : "▶ 재생";
    if (isPlaying) startAutoSlider();
  });

  function startAutoSlider() {
    if (sliderInterval) return;
    sliderInterval = setInterval(() => {
      if (!isPlaying) return;
      currentIndex++;
      if (currentIndex >= layerObjects.length) {
        currentIndex = 0;
        isPlaying = false;
        clearInterval(sliderInterval);
        sliderInterval = null;
        document.getElementById("toggleButton").textContent = "▶ 재생";
      }
      document.getElementById("timeSlider").value = currentIndex;
      document.getElementById("fireDateSelect").value = currentIndex;
      updateLayers(currentIndex); updateDateLabel(currentIndex);
      updateFiresForDate(dateIndexMap[currentIndex]); loadPredictedFirePointsForDate(dateIndexMap[currentIndex]);
    }, 2000);
  }

  // 첫 화면 초기화
  updateLayers(0); updateDateLabel(0);
  updateFiresForDate(dateIndexMap[0]); loadPredictedFirePointsForDate(dateIndexMap[0]);
}

// ===== [8] 환경설정 & 데이터 로딩 =====
Promise.all([
  fetch("/api/config").then(res => res.json()),
  fetch("fire_archive_SV-C2_616504.json").then(res => res.json()),
  fetch("fire_archive_SV-C2_616504.json").then(res => res.json())
]).then(([config, la, korea]) => {
  Cesium.Ion.defaultAccessToken = config.cesiumToken;
  Cesium.GoogleMaps.defaultApiKey = config.googleKey;
  fireData_la = la;
  fireData_korea = korea;
  init();
}).catch((error) => {
  console.error("🔥 초기화 실패:", error);
});

window.onload = function() {
  const btn = document.getElementById("toggleRegionBtn");
  btn.textContent = "🌏 국내 예측 보기";
  viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(-118.60, 34.1, 150000) });
  updateLayers(currentIndex);
  updateDateLabel(currentIndex);
  updateFiresForDate(dateIndexMap[currentIndex]);
  loadPredictedFirePointsForDate(dateIndexMap[currentIndex]);
};