let viewer;
let fireData = [];
let fireEntities = [];

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

function updateFiresForDate(selectedDate) {
  const fireInfo = document.getElementById("fireInfo");
  fireEntities.forEach((e) => viewer.entities.remove(e));
  fireEntities.length = 0;

  let fireCount = 0;

  fireData.forEach((fire) => {
    if (fire.acq_date !== selectedDate) return;

    let color = Cesium.Color.YELLOW.withAlpha(0.7);
    if (fire.confidence === "h") color = Cesium.Color.RED.withAlpha(0.8);
    else if (fire.confidence === "n")
      color = Cesium.Color.ORANGE.withAlpha(0.8);

    const frp = parseFloat(fire.frp);
    const size = Math.min(Math.max(frp / 8, 8), 20);

    const entity = viewer.entities.add({
      id: `fire-${fire.latitude}-${fire.longitude}-${fire.acq_date}`,
      position: Cesium.Cartesian3.fromDegrees(
        fire.longitude,
        fire.latitude,
        500
      ),
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
          fire.confidence === "h"
            ? "높음"
            : fire.confidence === "n"
            ? "중간"
            : "낮음"
        }<br/>
        <b>관측 위성:</b> ${fire.satellite || "-"}
      `,
    });

    fireEntities.push(entity);
    fireCount++;
  });

  if (fireInfo) {
    fireInfo.textContent = `🔥 ${selectedDate} 화재 지점 ${fireCount}개 시각화됨`;
    fireInfo.style.position = "absolute";
    fireInfo.style.top = "140px";
    fireInfo.style.right = "10px";
    fireInfo.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
    fireInfo.style.color = "white";
    fireInfo.style.padding = "6px 12px";
    fireInfo.style.borderRadius = "6px";
    fireInfo.style.fontFamily = "sans-serif";
    fireInfo.style.fontSize = "13px";
    fireInfo.style.zIndex = "10";
    fireInfo.style.pointerEvents = "none";
  }
}

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
    destination: Cesium.Cartesian3.fromDegrees(-118.35, 34.25, 7000),
  });

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
    const selectedDate = dateIndexMap[selectedIndex]; // e.g., "2025-01-08"

    // 📆 날짜 범위 계산 (start = D, end = D+1)
    const start = selectedDate;
    const end = new Date(new Date(selectedDate).getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    // 🌀 날씨 정보 표시 초기화
    weatherInfo.innerHTML = `
    📍 위도: ${lat.toFixed(4)}<br/>
    📍 경도: ${lon.toFixed(4)}<br/>
    <span style="color:gray">🌫️ 공기질 데이터를 불러오는 중...</span>
  `;

    // 🔍 AQI 색상 판별 함수
    function getAqiColor(aqi) {
      if (aqi <= 50) return "#00e400"; // Green
      if (aqi <= 100) return "#ffff00"; // Yellow
      if (aqi <= 150) return "#ff7e00"; // Orange
      if (aqi <= 200) return "#ff0000"; // Red
      if (aqi <= 300) return "#8f3f97"; // Purple
      return "#7e0023"; // Maroon
    }

    // ✅ 두 API 병렬 호출
    Promise.all([
      fetch(
        `/api/airquality?lat=${lat}&lon=${lon}&start=${start}&end=${end}`
      ).then((res) => res.json()),
      fetch(
        `/api/meteostat?lat=${lat}&lon=${lon}&start=${start}&end=${end}`
      ).then((res) => res.json()),
    ])
      .then(([airData, weatherData]) => {
        const aqi = airData?.data?.[0]?.aqi ?? null;
        const ws = weatherData?.data?.[0]?.wspd ?? "-";
        const wd = weatherData?.data?.[0]?.wdir ?? "-";
        const temp = weatherData?.data?.[0]?.temp ?? "-";
        const aqiColor = aqi !== null ? getAqiColor(aqi) : "#aaa";

        weatherInfo.innerHTML = `
        📍 위도: ${lat.toFixed(4)}
        📍 경도: ${lon.toFixed(4)}
        🌫️ AQI: <b style="color:${aqiColor}">${aqi ?? "데이터 없음"}</b>
        🌫️ 풍속: ${ws} m/s
        🧭 풍향: ${wd}°
        🌡️ 온도: ${temp}°C
      `;

        // 풍향 반영 회전
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

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement) => {
    const pickedObject = viewer.scene.pick(movement.endPosition);
    if (Cesium.defined(pickedObject) && pickedObject.id?.description) {
      viewer.selectedEntity = pickedObject.id;
    } else {
      viewer.selectedEntity = null;
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  const layerIds = [
    "20250108m-maxar",
    "20250109m-maxar",
    "20250110n-maxar",
    "20250113m-maxar",
    "20250114m-maxar",
    "20250116m-maxar",
    "20250118m-maxar",
    "20250120m-maxar",
  ];

  const layerLabels = [
    "2025-01-08",
    "2025-01-09",
    "2025-01-10",
    "2025-01-13",
    "2025-01-14",
    "2025-01-16",
    "2025-01-18",
    "2025-01-20",
  ];

  const layerObjects = [];

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

  const select = document.getElementById("fireDateSelect");
  const slider = document.getElementById("timeSlider");
  const toggleButton = document.getElementById("toggleButton");
  const dateLabel = document.getElementById("dateLabel");

  function updateLayers(index) {
    layerObjects.forEach((layer, idx) => {
      layer.show = idx === index;
      layer.alpha =
        idx === index
          ? idx === 0
            ? 1.0
            : 0.7 // 1월 8일은 완전 불투명하게
          : 0.0; // 다른 레이어는 완전히 숨김
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
}

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
