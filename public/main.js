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
    else if (fire.confidence === "n") color = Cesium.Color.ORANGE.withAlpha(0.8);

    const frp = parseFloat(fire.frp);
    const size = Math.min(Math.max(frp / 8, 8), 20);

    const entity = viewer.entities.add({
      id: `fire-${fire.latitude}-${fire.longitude}-${fire.acq_date}`,
      position: Cesium.Cartesian3.fromDegrees(fire.longitude, fire.latitude, 500),
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
        <b>화재 신뢰도:</b> ${fire.confidence === "h" ? "높음" : fire.confidence === "n" ? "중간" : "낮음"}<br/>
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

    weatherInfo.innerHTML = `
      📍 위도: ${lat.toFixed(4)}<br/>
      📍 경도: ${lon.toFixed(4)}<br/>
      <span style="color:gray">🌫️ 공기질 정보를 불러오는 중...</span>
    `;

    fetch(`/api/air?lat=${lat}&lon=${lon}`)
      .then((res) => res.json())
      .then((data) => {
        const pollution = data.data?.current?.pollution;
        const weather = data.data?.current?.weather;
        if (!pollution || !weather) {
          alert("❌ 공기질 데이터를 불러올 수 없습니다.");
          return;
        }

        weatherInfo.innerHTML = `
          📍 위도: ${lat.toFixed(4)}<br/>
          📍 경도: ${lon.toFixed(4)}<br/>
          🌫️ AQI: <b>${pollution.aqius}</b><br/>
          🌫️ 풍속: ${weather.ws} m/s<br/>
          🧽 풍향: ${weather.wd}°<br/>
          🌡️ 온도: ${weather.tp}°C
        `;
        windArrow.style.transform = `rotate(${weather.wd}deg)`;
      })
      .catch((err) => {
        console.error("❌ API 요청 실패:", err);
        alert("❌ 공기질 API 요청 실패");
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
    "20250108m-maxar", "20250109m-maxar", "20250110n-maxar", "20250113m-maxar",
    "20250114m-maxar", "20250116m-maxar", "20250118m-maxar", "20250120m-maxar"
  ];

  const layerLabels = [
    "2025-01-08", "2025-01-09", "2025-01-10", "2025-01-13",
    "2025-01-14", "2025-01-16", "2025-01-18", "2025-01-20"
  ];

  const layerObjects = [];
  for (let i = 0; i < layerIds.length; i++) {
    const imageryLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: `https://stormscdn.ngs.noaa.gov/${layerIds[i]}/{z}/{x}/{y}`,
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        maximumLevel: 19,
        credit: `NOAA MAXAR ${layerIds[i]}`,
        show: false,
        alpha: 0.7,
      })
    );
    layerObjects.push(imageryLayer);
  }

  const select = document.getElementById("fireDateSelect");
  const slider = document.getElementById("timeSlider");
  const toggleButton = document.getElementById("toggleButton");
  const dateLabel = document.getElementById("dateLabel");

  function updateLayers(index) {
    layerObjects.forEach((layer, idx) => {
      layer.show = idx === index;
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
