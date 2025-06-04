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
  loadKoreaFireData();
}

// 단계별 스타일 지정
function getVisualStyleByLevel(level) {
  switch (level) {
    case "초기대응":
      return {
        type: "point",
        color: Cesium.Color.YELLOW.withAlpha(0.8),
        size: 6,
      };
    case "1단계":
      return {
        type: "point",
        color: Cesium.Color.ORANGE.withAlpha(0.85),
        size: 9,
      };
    case "2단계":
      return {
        type: "point",
        color: Cesium.Color.fromCssColorString("#ff6666").withAlpha(0.9), // 밝은 빨강
        size: 12,
      };
    case "3단계":
      return {
        type: "point",
        color: Cesium.Color.fromCssColorString("#800080").withAlpha(1.0), // 보라색
        size: 14,
      };
    default:
      return {
        type: "point",
        color: Cesium.Color.GRAY.withAlpha(0.5),
        size: 6,
      };
  }
}

// 화재 + 기상 데이터 표시
async function loadKoreaFireData() {
  try {
    const res = await fetch("/data/korea_fire_weather.json");
    const fireData = await res.json();

    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");

    // ✅ 허용된 날짜 범위
    const allowedStartStr = "2024-10-01";
    const allowedEndStr = "2025-04-01";
    const allowedStart = new Date(allowedStartStr);
    const allowedEnd = new Date(allowedEndStr);

    // ✅ 입력값 제한
    startInput.value = allowedStartStr;
    endInput.value = allowedEndStr;
    startInput.min = allowedStartStr;
    startInput.max = allowedEndStr;
    endInput.min = allowedStartStr;
    endInput.max = allowedEndStr;

    function renderByRange(start, end) {
      viewer.entities.removeAll();

      const sDate = new Date(start);
      const eDate = new Date(end);

      let count = 0;

      fireData.forEach((item) => {
        const {
          start,
          time,
          address,
          status,
          level,
          lat,
          lon,
          temp,
          wspd,
          wdir,
          precip,
          rhum,
        } = item;

        const dataDateStr = start?.split("T")[0];
        if (!dataDateStr) return;
        const dataDate = new Date(dataDateStr);

        if (dataDate < sDate || dataDate > eDate) return;

        const style = getVisualStyleByLevel(level);

        const entityOptions = {
          position: Cesium.Cartesian3.fromDegrees(
            parseFloat(lon),
            parseFloat(lat)
          ),
          description: `
            📍 <b>주소:</b> ${address}<br/>
            🧨 <b>발생일시:</b> ${start ?? "-"}<br/>
            🕒 <b>진화일시:</b> ${time}<br/>
            🔥 <b>진행상태:</b> ${status}<br/>
            🧯 <b>대응단계:</b> ${level}<br/><br/>
            🌡️ <b>기온:</b> ${temp ?? "-"} ℃<br/>
            💨 <b>풍속:</b> ${wspd ?? "-"} m/s<br/>
            🧭 <b>풍향:</b> ${wdir ?? "-"}°<br/>
            ☔ <b>강수량:</b> ${precip ?? "-"} mm<br/>
            💧 <b>습도:</b> ${rhum ?? "-"} %<br/>
          `,
        };

        entityOptions.point = {
          pixelSize: style.size,
          color: style.color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        };

        viewer.entities.add(entityOptions);
        count++;
      });
      // 🔥 개수 표시
      const fireCountDiv = document.getElementById("fireCount");
      fireCountDiv.textContent = `🔥 화재 지점 ${count.toLocaleString()}개 표시됨`;

      console.log(`✅ ${start} ~ ${end} 범위로 ${count}개 시각화 완료`);
    }

    // ✅ 이벤트 리스너
    const onRangeChange = () => {
      const s = startInput.value;
      const e = endInput.value;
      const sDate = new Date(s);
      const eDate = new Date(e);

      if (sDate < allowedStart || eDate > allowedEnd || sDate > eDate) {
        alert("선택 가능한 날짜는 2024-10-01 ~ 2025-04-01입니다.");
        return;
      }
      renderByRange(s, e);
    };

    startInput.addEventListener("change", onRangeChange);
    endInput.addEventListener("change", onRangeChange);

    // 초기 전체 범위 렌더링
    renderByRange(allowedStartStr, allowedEndStr);
  } catch (err) {
    console.error("❌ 화재 데이터 로딩 실패:", err);
  }
}

// 상단 설명 박스
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
    <button id="toggleLegend" style="
      background: none;
      border: none;
      color: #00e0ff;
      font-weight: bold;
      cursor: pointer;
      padding: 0;
      margin-bottom: 6px;
    ">[접기]</button><br/>
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

  const toggleBtn = document.getElementById("toggleLegend");
  const content = document.getElementById("legendContent");

  toggleBtn.addEventListener("click", () => {
    if (content.style.display === "none") {
      content.style.display = "block";
      toggleBtn.textContent = "[접기]";
    } else {
      content.style.display = "none";
      toggleBtn.textContent = "[펼치기]";
    }
  });
}

// 설정 후 실행
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
