let viewer;
let fireData = [];
let fireEntities = [];
let predictedEntities = []; // 🔥 추가: 예측 마커 전역 변수
// 실제 산불 토글
let isActualVisible = true;
document.getElementById("toggleActualBtn").addEventListener("click", () => {
  isActualVisible = !isActualVisible;
  fireEntities.forEach(e => e.show = isActualVisible);
  document.getElementById("toggleActualBtn").textContent =
    isActualVisible ? "🔥 관측 화점 OFF" : "🔥 관측 화점 ON";
});

// 예측 마커 토글
let isPredVisible = true;
document.getElementById("togglePredBtn").addEventListener("click", () => {
  isPredVisible = !isPredVisible;
  predictedEntities.forEach(e => e.show = isPredVisible);
  document.getElementById("togglePredBtn").textContent =
    isPredVisible ? "🤖 AI 예측 화점 OFF" : "🤖 AI 예측 화점 ON";
});

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

// 날짜별로 산불 데이터를 뿌리는 함수
function updateFiresForDate(selectedDate) {
  const fireInfo = document.getElementById("fireInfo");
  fireEntities.forEach((e) => viewer.entities.remove(e));
  fireEntities.length = 0;

  let fireCount = 0;

  fireData.forEach((fire) => {
    if (fire.acq_date !== selectedDate) return;

    let color = Cesium.Color.YELLOW.withAlpha(0.7);
    if (fire.confidence === "h") color = Cesium.Color.RED.withAlpha(0.8);
    else if (fire.confidence === "n") color = Cesium.Color.ORANGE.withAlpha(0.8);

    const frp = parseFloat(fire.frp);
    const size = Math.min(Math.max(frp / 8, 8), 20);

    // ✅ 모든 날짜에 대해 약간의 무작위 오프셋 적용
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
        <b>밝기 (열 강도):</b> ${fire.brightness}<br/>
        <b>방사 강도 (FRP, MW):</b> ${fire.frp}<br/>
        <b>화재 신뢰도:</b> ${
          fire.confidence === "h" ? "높음" : fire.confidence === "n" ? "중간" : "낮음"
        }<br/>
        <b>관측 위성:</b> ${fire.satellite || "-"}
      `,
    });

    fireEntities.push(entity);
    fireCount++;
  });

  if (fireInfo) {
    fireInfo.textContent = `🔥 ${selectedDate} 화재 지점 ${fireCount}개 시각화됨`;
  }
}


// --- [1] 격자 설정 ---
const min_lat = 33.5;
const min_lon = -119.0;
const max_lat = 34.5;   // 원하는 영역 최대값으로 조정
const max_lon = -117.8; // 원하는 영역 최대값으로 조정
const cell_size = 0.05;

// --- [2] 전체 격자 그리기 (투명, 연한 선) ---
function drawAllGridLines() {
  const lat_cells = Math.ceil((max_lat - min_lat) / cell_size);
  const lon_cells = Math.ceil((max_lon - min_lon) / cell_size);

  for (let i = 0; i < lat_cells; i++) {
    for (let j = 0; j < lon_cells; j++) {
      const minLat = min_lat + i * cell_size;
      const minLon = min_lon + j * cell_size;
      const maxLat = minLat + cell_size;
      const maxLon = minLon + cell_size;

      viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([
            minLon, minLat, maxLon, minLat,
            maxLon, minLat, maxLon, maxLat,
            maxLon, maxLat, minLon, maxLat,
            minLon, maxLat, minLon, minLat,
          ]),
          width: 1.5, // 선 두께를 더 굵게
          material: Cesium.Color.WHITE.withAlpha(0.8), // 더 진한 흰색 계열
          clampToGround: true,
        }
      });
    }
  }
}

// --- [3] 예측 격자 Polygon 채우기 ---
function gridIdToLatLon(grid_id) {
  const parts = grid_id.split("_");
  const lat_idx = parseInt(parts[1]);
  const lon_idx = parseInt(parts[2]);

  const lat = min_lat + (lat_idx + 0.5) * cell_size;
  const lon = min_lon + (lon_idx + 0.5) * cell_size;
  return { lat, lon };
}

function loadPredictedFirePoints() {
  fetch("predicted_grid_fire_points.json")
    .then((res) => res.json())
    .then((data) => {
      predictedEntities.forEach(e => viewer.entities.remove(e));
      predictedEntities = [];

      data.forEach((pt) => {
        const { lat, lon } = gridIdToLatLon(pt.grid_id);

        // 확률에 따라 점의 색/투명도/크기 조정 (원하면 커스터마이즈)
        const color = Cesium.Color.RED.withAlpha(Math.max(0.4, pt.probability));
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

        predictedEntities.push(entity);
      });

      console.log(`✅ 예측 확률 마커 ${data.length}개 표시`);
    })
    .catch((err) => {
      console.error("❌ 예측 데이터 불러오기 실패:", err);
    });
}

// --- [4] init에서 두 함수 호출 ---
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
    destination: Cesium.Cartesian3.fromDegrees(-118.60, 34.1, 50000),
  });

  // --- [여기서 전체 격자 & 예측 polygon 호출!] ---
  drawAllGridLines();
  loadPredictedFireGrid();

  // ... (이하 원래 코드 유지) ...
}


async function init() {
  viewer = new Cesium.Viewer("cesiumContainer", {
    geocoder: true,
    baseLayerPicker: true,
    sceneModePicker: true,
    timeline: false,
    animation: false,
  });

  // 대기(Atmosphere) 효과 켜기
  viewer.scene.skyAtmosphere.show = true;

  try {
    const tileset = await Cesium.createGooglePhotorealistic3DTileset();
    viewer.scene.primitives.add(tileset);
  } catch (error) {
    console.error("🧨 3D 타일셋 생성 실패", error);
  }

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-118.60, 34.1, 50000),
  });

  const weatherInfo = document.getElementById("weatherInfo");
  const windArrow = document.getElementById("windArrow");
  let currentEntity = null;
  let lastClickTime = 0;

  // 지도 클릭 시 환경 데이터 팝업
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
      point: {
        pixelSize: 14,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.BLUE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(100, 1.2, 10000, 0.5),
      },
    });

    // 📍 현재 선택된 날짜 index → 실제 날짜로 변환
    const selectedIndex = parseInt(document.getElementById("timeSlider").value);
    const selectedDate = dateIndexMap[selectedIndex];
    // 날짜 범위 계산 (start = D, end = D+1)
    const start = selectedDate;
    const end = new Date(new Date(selectedDate).getTime() + 86400000).toISOString().slice(0, 10);

    // 🌀 날씨 정보 표시 초기화
    weatherInfo.innerHTML = `
      📍 위도: ${lat.toFixed(4)}<br/>
      📍 경도: ${lon.toFixed(4)}<br/>
      <span style="color:gray">🌫️ 공기질 데이터를 불러오는 중...</span>
    `;

    // AQI 색상 판별 함수
    function getAqiColor(aqi) {
      if (aqi <= 50) return "#00e400";
      if (aqi <= 100) return "#ffff00";
      if (aqi <= 150) return "#ff7e00";
      if (aqi <= 200) return "#ff0000";
      if (aqi <= 300) return "#8f3f97";
      return "#7e0023";
    }

    // ✅ Weatherbit + Meteostat API 병렬 호출
    Promise.all([
      fetch(`/api/airquality?lat=${lat}&lon=${lon}&start=${start}&end=${end}`).then((res) => res.json()),
      fetch(`/api/meteostat?lat=${lat}&lon=${lon}&start=${start}&end=${end}`).then((res) => res.json()),
    ])
      .then(([airData, weatherData]) => {
        const aqi = airData?.data?.[0]?.aqi ?? null;
        const o3 = airData?.data?.[0]?.o3 ?? "-";
        const ws = weatherData?.data?.[0]?.wspd ?? "-";
        const wd = weatherData?.data?.[0]?.wdir ?? "-";
        const temp = weatherData?.data?.[0]?.temp ?? "-";
        const rh = weatherData?.data?.[0]?.rhum ?? "-";
        const prcp = weatherData?.data?.[0]?.prcp ?? "-";
        const dew = weatherData?.data?.[0]?.dwpt ?? "-";

        const aqiColor = aqi !== null ? getAqiColor(aqi) : "#aaa";

        // 🗂️ 상세 환경 데이터 UI
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

        // 풍향에 따라 화살표 회전
        if (!isNaN(parseFloat(wd))) {
          windArrow.style.transform = `rotate(${wd}deg)`;
        }
      })
      .catch((err) => {
        console.error("❌ API 실패", err);
        weatherInfo.innerHTML = `
          📍 위도: ${lat.toFixed(4)}<br/>
          📍 경도: ${lon.toFixed(4)}<br/>
          ❌ 날씨 데이터 불러오기 실패
        `;
      });
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // 마우스 오버 시 fire info 팝업 표시
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement) => {
    const pickedObject = viewer.scene.pick(movement.endPosition);
    if (Cesium.defined(pickedObject) && pickedObject.id?.description) {
      viewer.selectedEntity = pickedObject.id;
    } else {
      viewer.selectedEntity = null;
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // NOAA MAXAR 시계열 타일 레이어
  const layerIds = [
    "20250108m-maxar", "20250109m-maxar", "20250110n-maxar", "20250113m-maxar",
    "20250114m-maxar", "20250116m-maxar", "20250118m-maxar", "20250120m-maxar",
  ];
  const layerLabels = [
    "2025-01-08", "2025-01-09", "2025-01-10", "2025-01-13",
    "2025-01-14", "2025-01-16", "2025-01-18", "2025-01-20",
  ];
  const layerObjects = [];

  // 각 날짜별로 타일 레이어 추가
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

  // 날짜 선택, 타임슬라이더 등 UI
  const select = document.getElementById("fireDateSelect");
  const slider = document.getElementById("timeSlider");
  const toggleButton = document.getElementById("toggleButton");
  const dateLabel = document.getElementById("dateLabel");

  function updateLayers(index) {
    layerObjects.forEach((layer, idx) => {
      layer.show = idx === index;
      layer.alpha = idx === index ? (idx === 0 ? 1.0 : 0.7) : 0.0;
    });
  }
  function updateDateLabel(index) {
    dateLabel.textContent = `🗓️ ${layerLabels[index]}`;
  }

  select.addEventListener("change", () => {
    const idx = parseInt(select.value);
    slider.value = idx;
    updateLayers(idx);
    updateDateLabel(idx);
    updateFiresForDate(dateIndexMap[idx]);
  });

  slider.addEventListener("input", () => {
    const idx = parseInt(slider.value);
    select.value = idx;
    updateLayers(idx);
    updateDateLabel(idx);
    updateFiresForDate(dateIndexMap[idx]);
  });

  let currentIndex = 0;
  let isPlaying = false;
  toggleButton.textContent = isPlaying ? "⏸ 일시정지" : "▶ 재생";
  let sliderInterval = null;

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
        toggleButton.textContent = "▶ 재생";
      }
      slider.value = currentIndex;
      select.value = currentIndex;
      updateLayers(currentIndex);
      updateDateLabel(currentIndex);
      updateFiresForDate(dateIndexMap[currentIndex]);
    }, 2000);
  }

  toggleButton.addEventListener("click", () => {
    isPlaying = !isPlaying;
    toggleButton.textContent = isPlaying ? "⏸ 일시정지" : "▶ 재생";
    if (isPlaying) startAutoSlider();
  });

  updateLayers(0);
  updateDateLabel(0);

  drawAllGridLines();
  loadPredictedFirePoints();   // 🔥 예측 데이터 시각화 호출
}

// 환경설정, 데이터 fetch 및 초기화
fetch("/api/config")
  .then((res) => res.json())
  .then((config) => {
    Cesium.Ion.defaultAccessToken = config.cesiumToken;
    Cesium.GoogleMaps.defaultApiKey = config.googleKey;
    return fetch("fire_archive_SV-C2_616504.json");
  })
  .then((response) => response.json())
  .then((data) => {
    fireData = data;
    init();
    updateFiresForDate(dateIndexMap[0]);
  })
  .catch((error) => {
    console.error("🔥 초기화 실패:", error);
  });
