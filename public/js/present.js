let viewer;
let currentView = "korea";
let koreaEntities = [];
let laEntities = [];
let allLAFireData = [];

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

function updateLoadingStatus(status) {
  const fireCountElement = document.getElementById("fireCount");
  if (fireCountElement) {
    fireCountElement.innerHTML = status;
  }
}

// 🔥 화재 리스트 업데이트 함수
function updateFireList(fireItems) {
  const fireListContainer = document.getElementById("fireList");
  if (!fireListContainer) return;

  if (fireItems.length === 0) {
    fireListContainer.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">선택된 기간에 화재가 없습니다</div>';
    return;
  }

  // 날짜별로 그룹화
  const groupedByDate = {};
  fireItems.forEach(item => {
    const dateStr = item.frfr_frng_dtm?.split(' ')[0] || item.frfr_frng_dtm?.split('T')[0];
    if (!groupedByDate[dateStr]) {
      groupedByDate[dateStr] = [];
    }
    groupedByDate[dateStr].push(item);
  });

  let html = '';
  
  // 날짜별로 정렬하여 표시 (최신순)
  Object.keys(groupedByDate)
    .sort((a, b) => new Date(b) - new Date(a))
    .forEach(dateStr => {
      const dayFires = groupedByDate[dateStr];
      
      // 날짜 헤더
      html += `<div class="date-separator">📅 ${dateStr} (${dayFires.length}건)</div>`;
      
      dayFires.forEach(fire => {
        const level = fire.frfr_step_issu_cd || '미분류';
        const status = fire.frfr_prgrs_stcd_str || '상태미상';
        const address = fire.frfr_sttmn_addr || '주소불명';
        const time = fire.frfr_frng_dtm?.split(' ')[1]?.substring(0, 5) || '';
        
        // 주소를 간략하게 표시
        const shortAddress = address.length > 20 ? address.substring(0, 20) + '...' : address;
        
        html += `
          <div class="fire-item level-${level}" 
               data-lat="${fire.frfr_lctn_ycrd}" 
               data-lon="${fire.frfr_lctn_xcrd}"
               data-entity-id="korea-${fire.frfr_lctn_ycrd}-${fire.frfr_lctn_xcrd}-${fire.frfr_frng_dtm}">
            <div class="fire-item-header">${shortAddress}</div>
            <div class="fire-item-details">
              🕒 ${time} | 🧯 ${level} | 🔥 ${status}
            </div>
          </div>
        `;
      });
    });

  fireListContainer.innerHTML = html;

  // 클릭 이벤트 추가 - 해당 화재 위치로 카메라 이동
  fireListContainer.querySelectorAll('.fire-item').forEach(item => {
    item.addEventListener('click', () => {
      const lat = parseFloat(item.dataset.lat);
      const lon = parseFloat(item.dataset.lon);
      const entityId = item.dataset.entityId;
      
      if (!isNaN(lat) && !isNaN(lon)) {
        // 카메라 이동
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 5000),
          duration: 2.0
        });
        
        // 해당 엔티티 하이라이트
        const entity = viewer.entities.getById(entityId);
        if (entity) {
          viewer.selectedEntity = entity;
          setTimeout(() => {
            if (viewer.selectedEntity === entity) {
              viewer.selectedEntity = null;
            }
          }, 3000);
        }
      }
    });
  });
}

// LA 화재 리스트 업데이트 함수
function updateLAFireList(fireItems) {
  const fireListContainer = document.getElementById("fireList");
  if (!fireListContainer) return;

  if (fireItems.length === 0) {
    fireListContainer.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">선택된 기간에 화재가 없습니다</div>';
    return;
  }

  // 날짜별로 그룹화
  const groupedByDate = {};
  fireItems.forEach(item => {
    const dateStr = item.acq_date;
    if (!groupedByDate[dateStr]) {
      groupedByDate[dateStr] = [];
    }
    groupedByDate[dateStr].push(item);
  });

  let html = '';
  
  Object.keys(groupedByDate)
    .sort((a, b) => new Date(b) - new Date(a))
    .forEach(dateStr => {
      const dayFires = groupedByDate[dateStr];
      
      html += `<div class="date-separator">📅 ${dateStr} (${dayFires.length}건)</div>`;
      
      dayFires.forEach((fire, index) => {
        const confidenceText = fire.confidence === 'h' ? '높음' : 
                              fire.confidence === 'n' ? '중간' : '낮음';
        const confidenceClass = fire.confidence === 'h' ? 'level-3단계' : 
                               fire.confidence === 'n' ? 'level-2단계' : 'level-1단계';
        
        html += `
          <div class="fire-item ${confidenceClass}" 
               data-lat="${fire.lat}" 
               data-lon="${fire.lon}">
            <div class="fire-item-header">LA 화재 #${index + 1}</div>
            <div class="fire-item-details">
              🌡️ 밝기: ${fire.brightness} | 🔒 ${confidenceText}
            </div>
          </div>
        `;
      });
    });

  fireListContainer.innerHTML = html;

  // LA 화재 클릭 이벤트
  fireListContainer.querySelectorAll('.fire-item').forEach(item => {
    item.addEventListener('click', () => {
      const lat = parseFloat(item.dataset.lat);
      const lon = parseFloat(item.dataset.lon);
      
      if (!isNaN(lat) && !isNaN(lon)) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 3000),
          duration: 2.0
        });
      }
    });
  });
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
  
  updateLoadingStatus("🔄 데이터 준비 중...");
  await loadKoreaFireData();
  await loadFirmsFireData();
}

function renderKoreaByFilter(start, end, levelFilter, statusFilter) {
  koreaEntities.forEach(entity => viewer.entities.remove(entity));
  koreaEntities = [];

  const sDate = new Date(start + 'T00:00:00');
  const eDate = new Date(end + 'T23:59:59.999');
  
  let count = 0;
  let filteredFireData = [];

  fireData.forEach((item) => {
    const {
      frfr_sttmn_addr,
      frfr_frng_dtm,
      potfr_end_dtm,
      frfr_prgrs_stcd_str,
      frfr_step_issu_cd,
      frfr_lctn_ycrd,
      frfr_lctn_xcrd,
      temp, wspd, wdir, precip, rhum,
      brightness, frp, confidence, satellite, instrument, nasa_distance_km
    } = item;

    let date;
    try {
      if (frfr_frng_dtm.includes(' ')) {
        date = new Date(frfr_frng_dtm.replace(' ', 'T'));
      } else {
        date = new Date(frfr_frng_dtm);
      }
    } catch (e) {
      console.warn(`날짜 파싱 실패: ${frfr_frng_dtm}`, e);
      return;
    }

    const level = frfr_step_issu_cd;
    const status = frfr_prgrs_stcd_str;
    const lat = parseFloat(frfr_lctn_ycrd);
    const lon = parseFloat(frfr_lctn_xcrd);

    if (!lat || !lon || isNaN(date.getTime())) {
      return;
    }

    if (date < sDate || date > eDate) {
      return;
    }
    
    if (levelFilter !== "전체" && level !== levelFilter) return;
    if (statusFilter !== "전체" && status !== statusFilter) return;

    filteredFireData.push(item);

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
        💧 <b>습도:</b> ${rhum ?? "-"} %<br/>
      `,
      // 🛰️ <b>NASA 밝기:</b> ${brightness ?? "-"}<br/>
      // 🔥 <b>FRP:</b> ${frp ?? "-"}<br/>
      // 🔒 <b>신뢰도:</b> ${confidence ?? "-"}<br/>
      // 📏 <b>위성거리:</b> ${nasa_distance_km ?? "-"} km 
    });

    koreaEntities.push(entity);
    if (currentView === "korea") viewer.entities.add(entity);
    count++;
  });

  if (currentView === "korea") {
    updateLoadingStatus(`🔥 국내 화재 ${count.toLocaleString()}개 표시됨`);
    updateFireList(filteredFireData);
  }
}

async function loadKoreaFireData() {
  try {
    updateLoadingStatus("🔄 국내 화재 데이터 로딩 중...");
    
    const res = await fetch("/data/korea_fire_weather.json");
    const fireData = await res.json();
    window.fireData = fireData;

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

function renderLAByDateFilter() {
  if (currentView !== "la") return;

  laEntities.forEach(entity => viewer.entities.remove(entity));
  laEntities = [];

  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");
  const startDate = new Date(startInput.value + 'T00:00:00');
  const endDate = new Date(endInput.value + 'T23:59:59.999');

  let count = 0;
  let filteredLAData = [];

  allLAFireData.forEach((fireItem) => {
    const fireDate = new Date(fireItem.acq_date);
    
    if (fireDate < startDate || fireDate > endDate) return;

    filteredLAData.push(fireItem);

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

  updateLoadingStatus(`🌍 LA FIRMS 화재 ${count}개 표시됨<br/>(${startInput.value} ~ ${endInput.value})`);
  updateLAFireList(filteredLAData);
}

async function loadFirmsFireData() {
  try {
    if (currentView === "la") {
      updateLoadingStatus("🔄 LA 실시간 데이터 로딩 중...");
    }
    
    const res = await fetch("https://firms.modaps.eosdis.nasa.gov/api/country/csv/573b907a0b0ba57fc914ff9e701a620e/VIIRS_SNPP_NRT/USA/7");
    const text = await res.text();
    const lines = text.split("\n").slice(1);

    allLAFireData = [];

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

      allLAFireData.push({
        lat,
        lon,
        brightness,
        acq_date,
        confidence
      });
    });

    console.log(`✅ LA 데이터 로딩 완료: ${allLAFireData.length}개`);
    
    if (currentView === "la") {
      renderLAByDateFilter();
    }
    
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
  const fireListTitle = document.querySelector("#fireListPanel h4");
  const datePanel = document.getElementById("datePanel");
  const fireListPanel = document.getElementById("fireListPanel"); // 🔥 추가
  
  btn.addEventListener("click", () => {
    viewer.entities.removeAll();

    if (currentView === "korea") {
      currentView = "la";
      
      if (levelFilterDiv) levelFilterDiv.style.display = "none";
      if (statusFilterDiv) statusFilterDiv.style.display = "none";
      
      if (pageDescription) {
        pageDescription.innerHTML = "LA 지역 실시간 FIRMS 위성 화재 감지 <br/>데이터를 시각화합니다.(7일 기준)";
      }
      
      if (fireListTitle) {
        fireListTitle.textContent = "🌍 LA 화재 발생 지역";
      }
      
      // 🔥 LA 모드에서 패널 간격 조정 (더 큰 간격)
      if (fireListPanel) {
        fireListPanel.style.bottom = "250px"; // 더 위로 올림
        fireListPanel.style.maxHeight = "180px"; // 높이 더 줄임
        fireListPanel.style.width = "220px"; // 폭 줄임
      }
      
      if (datePanel) {
        datePanel.style.width = "240px";
        datePanel.style.padding = "8px";
        datePanel.style.fontSize = "13px";
        datePanel.style.bottom = "20px"; // 그대로 유지
        
        const inputs = datePanel.querySelectorAll('input, select');
        inputs.forEach(input => {
          input.style.fontSize = "12px";
          input.style.padding = "3px";
        });
        
        const labels = datePanel.querySelectorAll('label');
        labels.forEach(label => {
          label.style.fontSize = "12px";
        });
      }
      
      if (allLAFireData.length > 0) {
        renderLAByDateFilter();
      } else {
        updateLoadingStatus("🔄 LA 데이터 로딩 중...");
        const fireListContainer = document.getElementById("fireList");
        if (fireListContainer) {
          fireListContainer.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">LA 데이터 로딩 중...</div>';
        }
      }
      
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-118.60, 34.1, 150000),
      });
      btn.textContent = "🗺️ 국내 보기 ON";
      
    } else {
      currentView = "korea";
      
      if (levelFilterDiv) levelFilterDiv.style.display = "block";
      if (statusFilterDiv) statusFilterDiv.style.display = "block";
      
      if (pageDescription) {
        pageDescription.textContent = "오늘 기준 최근 7일 간의 국내 산불 발생 정보를 시각화합니다.";
      }
      
      if (fireListTitle) {
        fireListTitle.textContent = "🔥 화재 발생 지역";
      }
      
      // 🔥 국내 모드로 복원
      if (fireListPanel) {
        fireListPanel.style.bottom = "280px"; // 원래 위치
        fireListPanel.style.maxHeight = "200px"; // 원래 높이
        fireListPanel.style.width = "240px"; // 원래 폭
      }
      
      if (datePanel) {
        datePanel.style.width = "auto";
        datePanel.style.padding = "12px";
        datePanel.style.fontSize = "14px";
        datePanel.style.bottom = "20px";
        
        const inputs = datePanel.querySelectorAll('input, select');
        inputs.forEach(input => {
          input.style.fontSize = "14px";
          input.style.padding = "6px";
        });
        
        const labels = datePanel.querySelectorAll('label');
        labels.forEach(label => {
          label.style.fontSize = "14px";
        });
      }
      
      koreaEntities.forEach(e => viewer.entities.add(e));
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(127.7669, 35.9078, 500000.0),
      });
      btn.textContent = "🌏 LA 보기 ON";
      updateLoadingStatus(`🔥 국내 화재 ${koreaEntities.length}개 표시됨`);
      
      const startInput = document.getElementById("startDate");
      const endInput = document.getElementById("endDate");
      const levelSelect = document.getElementById("levelFilter");
      const statusSelect = document.getElementById("statusFilter");
      
      if (startInput && endInput && levelSelect && statusSelect) {
        renderKoreaByFilter(
          startInput.value,
          endInput.value,
          levelSelect.value,
          statusSelect.value
        );
      }
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