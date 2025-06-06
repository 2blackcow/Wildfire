let viewer;

async function init() {
  viewer = new Cesium.Viewer("cesiumContainer", {
    geocoder: true,
    baseLayerPicker: true,
    sceneModePicker: true,
    timeline: false,
    animation: false,
    terrain: Cesium.Terrain.fromWorldTerrain(),
  });

  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.globe.enableLighting = true;

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(127.7669, 35.9078, 500000.0),
  });

  addLegendBox();
  await loadKoreaFireData();
}

function getVisualStyleByLevel(level) {
  switch (level) {
    case "초기대응":
      return { color: Cesium.Color.YELLOW.withAlpha(0.8), size: 6 };
    case "1단계":
      return { color: Cesium.Color.ORANGE.withAlpha(0.85), size: 9 };
    case "2단계":
      return {
        color: Cesium.Color.fromCssColorString("#ff6666").withAlpha(0.9),
        size: 12,
      };
    case "3단계":
      return {
        color: Cesium.Color.fromCssColorString("#800080").withAlpha(1.0),
        size: 14,
      };
    default:
      return { color: Cesium.Color.GRAY.withAlpha(0.5), size: 6 };
  }
}

async function loadKoreaFireData() {
  try {
    const res = await fetch("/data/korea_fire_full.json");
    const fireData = await res.json();

    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");
    const levelSelect = document.getElementById("levelFilter");
    const statusSelect = document.getElementById("statusFilter");

    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const allowedStartStr = sevenDaysAgo.toISOString().split("T")[0];
    const allowedEndStr = today.toISOString().split("T")[0];

    startInput.min = allowedStartStr;
    startInput.max = allowedEndStr;
    endInput.min = allowedStartStr;
    endInput.max = allowedEndStr;

    startInput.value = allowedStartStr;
    endInput.value = allowedEndStr;

    function renderByFilter(start, end, levelFilter, statusFilter) {
      viewer.entities.removeAll();

      const sDate = new Date(start);
      const eDate = new Date(end);
      let count = 0;

      fireData.forEach((item) => {
        const {
          frfr_sttmn_addr,
          frfr_frng_dtm,
          potfr_end_dtm,
          frfr_prgrs_stcd_str,
          frfr_step_issu_cd,
          frfr_lctn_ycrd,
          frfr_lctn_xcrd,
          temp,
          wspd,
          wdir,
          precip,
          rhum,
          brightness,
          frp,
          confidence,
          satellite,
          instrument,
          nasa_distance_km
        } = item;

        const date = new Date(frfr_frng_dtm);
        const level = frfr_step_issu_cd;
        const status = frfr_prgrs_stcd_str;
        const lat = parseFloat(frfr_lctn_ycrd);
        const lon = parseFloat(frfr_lctn_xcrd);

        if (!lat || !lon || isNaN(date) || date < sDate || date > eDate) return;
        if (levelFilter !== "전체" && level !== levelFilter) return;
        if (statusFilter !== "전체" && status !== statusFilter) return;

        const style = getVisualStyleByLevel(level);

        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          point: {
            pixelSize: style.size,
            color: style.color,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          description: `
            📍 <b>주소:</b> ${frfr_sttmn_addr}<br/>
            🧨 <b>발생일시:</b> ${frfr_frng_dtm}<br/>
            🕒 <b>진화일시:</b> ${potfr_end_dtm}<br/>
            🔥 <b>진행상태:</b> ${status}<br/>
            🧯 <b>대응단계:</b> ${level}<br/><br/>
            🌡️ <b>기온:</b> ${temp ?? "-"} ℃<br/>
            💨 <b>풍속:</b> ${wspd ?? "-"} m/s<br/>
            🧭 <b>풍향:</b> ${wdir ?? "-"}°<br/>
            ☔ <b>강수량:</b> ${precip ?? "-"} mm<br/>
            💧 <b>습도:</b> ${rhum ?? "-"} %<br/><br/>
            🛰️ <b>NASA 밝기:</b> ${brightness ?? "-"}<br/>
            🔥 <b>FRP:</b> ${frp ?? "-"}<br/>
            🔒 <b>신뢰도:</b> ${confidence ?? "-"}<br/>
            📏 <b>위성거리:</b> ${nasa_distance_km ?? "-"} km
          `,
        });

        count++;
      });

      document.getElementById("fireCount").textContent = `🔥 화재 지점 ${count.toLocaleString()}개 표시됨`;
    }

    const updateRender = () => {
      renderByFilter(
        startInput.value,
        endInput.value,
        levelSelect.value,
        statusSelect.value
      );
    };

    startInput.addEventListener("change", updateRender);
    endInput.addEventListener("change", updateRender);
    levelSelect.addEventListener("change", updateRender);
    statusSelect.addEventListener("change", updateRender);

    updateRender();
  } catch (err) {
    console.error("❌ 화재 데이터 로딩 실패:", err);
  }
}

function addLegendBox() {
  const legend = document.createElement("div");
  legend.id = "legendBox";
  legend.style.position = "absolute";
  legend.style.top = "10px";
  legend.style.left = "10px";
  legend.style.padding = "10px 14px";
  legend.style.background = "rgba(0,0,0,0.6)";
  legend.style.color = "white";
  legend.style.fontSize = "13px";
  legend.style.borderRadius = "8px";
  legend.style.zIndex = "100";
  legend.style.transition = "max-height 0.3s ease";
  legend.style.overflow = "hidden";
  legend.style.maxHeight = "300px";

  legend.innerHTML = `
    <button id="toggleLegend" style="background: none; border: none; color: #00e0ff; font-weight: bold; cursor: pointer; padding: 0; margin-bottom: 6px;">[접기]</button><br/>
    <div id="legendContent">
      <b>🔥 산불 대응단계 시각화 안내</b><br/>
      📍클릭 시 해당 지점 상세 정보 표시 <br/>
      🟡 초기대응 (노란색 점)<br/>
      🟠 1단계 (주황색 점)<br/>
      🔴 2단계 (밝은 빨강 점)<br/>
      🟣 3단계 (보라색 점)<br/>
    </div>
  `;

  document.body.appendChild(legend);

  document.getElementById("toggleLegend").addEventListener("click", () => {
    const content = document.getElementById("legendContent");
    const btn = document.getElementById("toggleLegend");
    const isOpen = content.style.display !== "none";
    content.style.display = isOpen ? "none" : "block";
    btn.textContent = isOpen ? "[펼치기]" : "[접기]";
  });
}

fetch("/api/config")
  .then((res) => res.json())
  .then((config) => {
    Cesium.Ion.defaultAccessToken = config.cesiumToken;
    Cesium.GoogleMaps.defaultApiKey = config.googleKey;
    init();
  })
  .catch((err) => {
    console.error("❌ config 불러오기 실패:", err);
  });
