let viewer;
let currentView = "korea";
let koreaEntities = [];
let laEntities = [];
let allLAFireData = []; // 원본 LA 데이터 저장

function getVisualStyleByLevel(level) {
  switch (level) {
    case "초기대응":
      return { color: Cesium.Color.YELLOW.withAlpha(0.8), size: 6 };
    case "1단계":
      return { color: Cesium.Color.ORANGE.withAlpha(0.85), size: 9 };
    case "2단계":
      return { color: Cesium.Color.fromCssColorString("#ff6666").withAlpha(0.9), size: 12 };
    case "3단계":
      return { color: Cesium.Color.fromCssColorString("#800080").withAlpha(1.0), size: 14 };
    default:
      return { color: Cesium.Color.GRAY.withAlpha(0.5), size: 6 };
  }
}

// 로딩 상태 업데이트 함수
function updateLoadingStatus(status) {
  const fireCountElement = document.getElementById("fireCount");
  if (fireCountElement) {
    fireCountElement.textContent = status;
  }
}

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
  setupToggleView();
  
  // 초기 로딩 상태 표시
  updateLoadingStatus("🔄 데이터 준비 중...");
  
  // 국내 데이터 먼저 로드 (빠른 로컬 파일)
  await loadKoreaFireData();
  
  // LA 데이터는 백그라운드에서 로드
  await loadFirmsFireData();
}

async function loadKoreaFireData() {
  try {
    updateLoadingStatus("🔄 국내 화재 데이터 로딩 중...");
    
    const res = await fetch("/data/korea_fire_weather.json");
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

    function renderKoreaByFilter(start, end, levelFilter, statusFilter) {
      // 기존 한국 엔티티만 제거
      koreaEntities.forEach(entity => viewer.entities.remove(entity));
      koreaEntities = [];

      // 🔧 날짜 범위 설정 수정
      const sDate = new Date(start);
      const eDate = new Date(end);
      
      // 🔥 종료일을 23:59:59.999로 설정하여 해당 날짜 전체 포함
      eDate.setHours(23, 59, 59, 999);
      
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

        // 🔧 날짜 파싱 및 비교 개선
        const date = new Date(frfr_frng_dtm);
        const level = frfr_step_issu_cd;
        const status = frfr_prgrs_stcd_str;
        const lat = parseFloat(frfr_lctn_ycrd);
        const lon = parseFloat(frfr_lctn_xcrd);

        // 🔍 디버그용 로그 (개발 중에만 사용)
        if (count < 3) {
          console.log(`화재 ${count}: ${frfr_frng_dtm} -> ${date}, 범위: ${sDate} ~ ${eDate}`);
        }

        // 유효성 검사 및 날짜 필터링
        if (!lat || !lon || isNaN(date.getTime()) || date < sDate || date > eDate) {
          return;
        }
        
        if (levelFilter !== "전체" && level !== levelFilter) return;
        if (statusFilter !== "전체" && status !== statusFilter) return;

        const style = getVisualStyleByLevel(level);

        const entity = new Cesium.Entity({
          id: `korea-${lat}-${lon}-${frfr_frng_dtm}`,
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
            🕒 <b>진화일시:</b> ${potfr_end_dtm || "진화 중"}<br/>
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

        koreaEntities.push(entity);
        if (currentView === "korea") viewer.entities.add(entity);
        count++;
      });

      if (currentView === "korea") {
        updateLoadingStatus(`🔥 국내 화재 ${count.toLocaleString()}개 표시됨`);
        console.log(`✅ 최종 표시된 화재: ${count}개 (날짜 범위: ${sDate.toISOString()} ~ ${eDate.toISOString()})`);
      }
    }

    const updateKoreaRender = () => {
      renderKoreaByFilter(
        startInput.value,
        endInput.value,
        levelSelect.value,
        statusSelect.value
      );
    };

    startInput.addEventListener("change", updateKoreaRender);
    endInput.addEventListener("change", updateKoreaRender);
    levelSelect.addEventListener("change", updateKoreaRender);
    statusSelect.addEventListener("change", updateKoreaRender);

    updateKoreaRender();
  } catch (err) {
    console.error("❌ 화재 데이터 로딩 실패:", err);
    updateLoadingStatus("❌ 국내 데이터 로딩 실패");
  }
}

// LA 데이터 날짜별 필터링 함수
function renderLAByDateFilter() {
  if (currentView !== "la") return;

  // 기존 LA 엔티티 제거
  laEntities.forEach(entity => viewer.entities.remove(entity));
  laEntities = [];

  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");
  const startDate = new Date(startInput.value);
  const endDate = new Date(endInput.value);
  
  // LA 데이터도 23:59:59까지 포함
  endDate.setHours(23, 59, 59, 999);

  let count = 0;

  allLAFireData.forEach((fireItem) => {
    const fireDate = new Date(fireItem.acq_date);
    
    // 날짜 범위 체크
    if (fireDate < startDate || fireDate > endDate) return;

    const entity = new Cesium.Entity({
      id: `la-${fireItem.lat}-${fireItem.lon}-${fireItem.acq_date}`,
      position: Cesium.Cartesian3.fromDegrees(fireItem.lon, fireItem.lat),
      point: {
        pixelSize: 8,
        color: fireItem.confidence === "h" ? Cesium.Color.RED.withAlpha(0.8)
              : fireItem.confidence === "n" ? Cesium.Color.ORANGE.withAlpha(0.8)
              : Cesium.Color.YELLOW.withAlpha(0.8),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      description: `📅 <b>일자:</b> ${fireItem.acq_date}<br/>🌡 <b>밝기:</b> ${fireItem.brightness}<br/>🔥 <b>신뢰도:</b> ${fireItem.confidence}`
    });

    laEntities.push(entity);
    viewer.entities.add(entity);
    count++;
  });

  updateLoadingStatus(`🌍 LA FIRMS 화재 ${count}개 표시됨 (${startInput.value} ~ ${endInput.value})`);
}

async function loadFirmsFireData() {
  try {
    // LA 뷰일 때만 로딩 상태 표시
    if (currentView === "la") {
      updateLoadingStatus("🔄 LA 실시간 데이터 로딩 중...");
    }
    
    const res = await fetch("https://firms.modaps.eosdis.nasa.gov/api/country/csv/573b907a0b0ba57fc914ff9e701a620e/VIIRS_SNPP_NRT/USA/7");
    const text = await res.text();
    const lines = text.split("\n").slice(1);

    allLAFireData = []; // 원본 데이터 초기화

    lines.forEach((line) => {
      const tokens = line.split(",");
      if (tokens.length < 11) return;

      const lat = parseFloat(tokens[1]);
      const lon = parseFloat(tokens[2]);
      const brightness = tokens[3];
      const acq_date = tokens[6];
      const confidence = tokens[10]?.trim();

      if (isNaN(lat) || isNaN(lon)) return;
      if (lat < 33.5 || lat > 34.4 || lon < -119.2 || lon > -117.8) return;

      // 원본 데이터에 저장
      allLAFireData.push({
        lat,
        lon,
        brightness,
        acq_date,
        confidence
      });
    });

    console.log(`✅ LA 데이터 로딩 완료: ${allLAFireData.length}개`);
    
    // LA 뷰인 경우 즉시 렌더링
    if (currentView === "la") {
      renderLAByDateFilter();
    }
    
    // 날짜 변경 이벤트 리스너 추가 (LA 데이터용)
    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");
    
    startInput.addEventListener("change", () => {
      if (currentView === "la") {
        renderLAByDateFilter();
      }
    });
    
    endInput.addEventListener("change", () => {
      if (currentView === "la") {
        renderLAByDateFilter();
      }
    });
    
  } catch (e) {
    console.error("❌ FIRMS API 호출 실패", e);
    // LA 뷰일 때만 에러 메시지 표시
    if (currentView === "la") {
      updateLoadingStatus("❌ LA 데이터 로딩 실패");
    }
  }
}

function setupToggleView() {
  const btn = document.getElementById("toggleViewBtn");
  const levelFilterDiv = document.getElementById("levelFilterDiv");
  const statusFilterDiv = document.getElementById("statusFilterDiv");
  const pageDescription = document.getElementById("pageDescription");
  
  btn.addEventListener("click", () => {
    viewer.entities.removeAll();

    if (currentView === "korea") {
      currentView = "la";
      
      // 한국 전용 필터 숨기기
      if (levelFilterDiv) levelFilterDiv.style.display = "none";
      if (statusFilterDiv) statusFilterDiv.style.display = "none";
      
      // 페이지 설명 변경
      if (pageDescription) {
        pageDescription.textContent = "LA 지역 실시간 FIRMS 위성 화재 감지 데이터를 시각화합니다.(7일 기준)";
      }
      
      // LA 데이터가 로드되었으면 즉시 렌더링
      if (allLAFireData.length > 0) {
        renderLAByDateFilter();
      } else {
        updateLoadingStatus("🔄 LA 데이터 로딩 중...");
      }
      
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-118.60, 34.1, 150000),
      });
      btn.textContent = "🗺️ 국내 보기 ON";
      
    } else {
      currentView = "korea";
      
      // 한국 전용 필터 다시 보이기
      if (levelFilterDiv) levelFilterDiv.style.display = "block";
      if (statusFilterDiv) statusFilterDiv.style.display = "block";
      
      // 페이지 설명 원래대로
      if (pageDescription) {
        pageDescription.textContent = "현재 페이지는 오늘 기준 최근 7일 간의 국내 산불 발생 정보를 시각화합니다.";
      }
      
      koreaEntities.forEach(e => viewer.entities.add(e));
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(127.7669, 35.9078, 500000.0),
      });
      btn.textContent = "🌏 LA 보기 ON";
      updateLoadingStatus(`🔥 국내 화재 ${koreaEntities.length}개 표시됨`);
    }
  });
}

function addLegendBox() {
  const legend = document.createElement("div");
  legend.id = "legendBox";
  legend.style = `position: absolute; top: 10px; left: 10px; padding: 10px 14px; background: rgba(0,0,0,0.6); color: white; font-size: 13px; border-radius: 8px; z-index: 100; max-height: 300px; overflow: hidden;`;
  legend.innerHTML = `
    <button id="toggleLegend" style="background: none; border: none; color: #00e0ff; font-weight: bold; cursor: pointer; padding: 0; margin-bottom: 6px;">[접기]</button><br/>
    <div id="legendContent">
      <b>🔥 국내 산불 대응단계</b><br/>
      🟡 초기대응<br/> 🟠 1단계<br/> 🔴 2단계<br/> 🟣 3단계<br/>
      <br/>
      <b>🌍 FIRMS 신뢰도</b><br/>
      🔴 High<br/> 🟠 Nominal<br/> 🟡 Low
    </div>
  `;
  document.body.appendChild(legend);

  const toggleBtn = document.getElementById("toggleLegend");
  const content = document.getElementById("legendContent");
  toggleBtn.addEventListener("click", () => {
    const shown = content.style.display !== "none";
    content.style.display = shown ? "none" : "block";
    toggleBtn.textContent = shown ? "[펼치기]" : "[접기]";
  });
}

fetch("/api/config")
  .then(res => res.json())
  .then(config => {
    Cesium.Ion.defaultAccessToken = config.cesiumToken;
    Cesium.GoogleMaps.defaultApiKey = config.googleKey;
    init();
  })
  .catch(err => {
    console.error("❌ config 불러오기 실패:", err);
  });