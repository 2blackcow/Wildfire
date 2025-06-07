let viewer;
let allFireData = []; // 전체 데이터 저장

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

  // 한국 중심으로 카메라 설정
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(127.7669, 35.9078, 800000.0),
  });

  loadKoreaFireData();
  setupDateControls();
}

// 단계별 스타일 지정 (크기 증가 - 더 잘 보이도록)
function getVisualStyleByLevel(level) {
  switch (level) {
    case "초기대응":
      return {
        color: Cesium.Color.YELLOW.withAlpha(0.8),
        size: 10,
      };
    case "1단계":
      return {
        color: Cesium.Color.ORANGE.withAlpha(0.85),
        size: 18,
      };
    case "2단계":
      return {
        color: Cesium.Color.fromCssColorString("#ff6666").withAlpha(0.9),
        size: 22,
      };
    case "3단계":
      return {
        color: Cesium.Color.fromCssColorString("#800080").withAlpha(0.95),
        size: 26,
      };
    default:
      return {
        color: Cesium.Color.GRAY.withAlpha(0.6),
        size: 14,
      };
  }
}

// 한국 화재 데이터 로딩 및 시각화
async function loadKoreaFireData() {
  try {
    // 상대 경로로 JSON 파일 접근
    const res = await fetch("../../data/korea_fire_2024_2025_with_weather.json");
    const fireData = await res.json();

    console.log(`📊 전체 화재 데이터 ${fireData.length}개 로드됨`);

    // 2024/10/01 ~ 2025/04/01 기간 데이터 필터링
    const fullPeriodData = fireData.filter(item => {
      const dateField = item.frfr_frng_dtm || item.start || item.date;
      if (!dateField) return false;
      
      const dataDate = new Date(dateField.split(" ")[0]);
      return dataDate >= new Date("2024-10-01") && dataDate <= new Date("2025-04-01");
    });

    console.log(`✅ 전체기간 화재 데이터 ${fullPeriodData.length}개 필터링됨`);
    
    if (fullPeriodData.length === 0) {
      console.warn("⚠️ 전체기간 데이터가 없습니다. 전체 데이터 구조를 확인합니다:");
      console.log("첫 번째 데이터 샘플:", fireData[0]);
      updateFireCount("전체기간 데이터 없음");
      return;
    }
    
    // 전체 데이터 저장
    allFireData = fullPeriodData;
    
    // 초기 전체 범위로 렌더링
    renderFireData(fullPeriodData);
    setupDateRangeFilter();

  } catch (err) {
    console.error("❌ 화재 데이터 로딩 실패:", err);
    updateFireCount("데이터 로딩 실패");
    
    // 대체 경로들로 시도
    console.log("🔄 대체 경로로 재시도 중...");
    await tryAlternatePaths();
  }
}

// 대체 경로들로 시도하는 함수
async function tryAlternatePaths() {
  const alternatePaths = [
    "/data/korea_fire_2024_2025_with_weather.json",
    "../data/korea_fire_2024_2025_with_weather.json",
    "data/korea_fire_2024_2025_with_weather.json",
    "/korea_fire_2024_2025_with_weather.json"
  ];

  for (const path of alternatePaths) {
    try {
      console.log(`🔍 시도 중: ${path}`);
      const res = await fetch(path);
      if (res.ok) {
        const fireData = await res.json();
        console.log(`✅ 성공! ${path}에서 ${fireData.length}개 데이터 로드됨`);
        
        const fullPeriodData = fireData.filter(item => {
          const dateField = item.frfr_frng_dtm || item.start || item.date;
          if (!dateField) return false;
          
          const dataDate = new Date(dateField.split(" ")[0]);
          return dataDate >= new Date("2024-10-01") && dataDate <= new Date("2025-04-01");
        });

        console.log(`📅 전체기간 데이터: ${fullPeriodData.length}개`);
        
        if (fullPeriodData.length > 0) {
          allFireData = fullPeriodData;
          renderFireData(fullPeriodData);
          setupDateRangeFilter();
          return;
        }
      }
    } catch (err) {
      console.log(`❌ ${path} 실패:`, err.message);
    }
  }
  
  console.error("❌ 모든 경로 시도 실패");
  updateFireCount("JSON 파일을 찾을 수 없음");
}

// 화재 데이터 시각화 (최적화된 버전)
function renderFireData(fireData, startDate = "2024-10-01", endDate = "2025-04-01") {
  console.log(`🎯 renderFireData 호출됨 - 입력 데이터: ${fireData.length}개`);
  
  viewer.entities.removeAll();

  const sDate = new Date(startDate);
  const eDate = new Date(endDate);
  let count = 0;
  
  // 통계 초기화
  const stats = {
    초기대응: 0,
    "1단계": 0,
    "2단계": 0,
    "3단계": 0
  };

  // 성능 최적화를 위한 배치 처리
  const entities = [];
  
  fireData.forEach((item, index) => {
    // JSON 구조에 맞는 필드명 사용
    const fireStartTime = item.frfr_frng_dtm || item.start || item.date;
    const fireEndTime = item.potfr_end_dtm || item.time || item.end_time;
    const address = item.frfr_sttm_addr || item.address || '정보 없음';
    const status = item.frfr_prgrs_stcd_str || item.status || '정보 없음';
    const level = item.frfr_step_issu_cd || item.level || '정보 없음';
    const lat = item.frfr_lctn_ycrd || item.lat || item.latitude;
    const lon = item.frfr_lctn_xcrd || item.lon || item.longitude;
    
    // 기상 데이터
    const temp = item.temp;
    const wspd = item.wspd;
    const wdir = item.wdir;
    const precip = item.precip;
    const rhum = item.rhum;

    // 날짜 필터링
    if (!fireStartTime) return;
    
    const dataDateStr = fireStartTime.split(" ")[0];
    const dataDate = new Date(dataDateStr);
    
    if (dataDate < sDate || dataDate > eDate) return;

    // 위치 정보 확인
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    
    if (isNaN(latitude) || isNaN(longitude)) return;
    
    // 한국 범위 체크
    if (latitude < 33 || latitude > 39 || longitude < 124 || longitude > 132) return;

    // 통계 업데이트
    if (stats.hasOwnProperty(level)) {
      stats[level]++;
    }

    const style = getVisualStyleByLevel(level);

    try {
      const entity = {
        id: `fire-${index}-${dataDateStr}`,
        position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 1000),
        point: {
          pixelSize: style.size,
          color: style.color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scaleByDistance: new Cesium.NearFarScalar(1000.0, 2.0, 2000000.0, 0.6),
        },
        description: `
          <div style="font-family: 'Segoe UI', sans-serif; line-height: 1.6; background: rgba(0, 0, 0, 0.9); color: white; padding: 16px; border-radius: 8px; margin: -8px; max-width: 400px;">
            <h3 style="margin: 0 0 12px 0; color:rgb(255, 255, 255); font-size: 16px; border-bottom: 1px solid #333; padding-bottom: 8px;">🔥 화재 정보</h3>
            
            <div style="background: rgba(255, 255, 255, 0.1); padding: 12px; border-radius: 6px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.2);">
              <div style="margin-bottom: 6px;"><strong style="color: #ffd700;">📍 위치:</strong> <span style="color: #e0e0e0;">${address}</span></div>
              <div style="margin-bottom: 6px;"><strong style="color: #ffd700;">🧨 발생일시:</strong> <span style="color: #e0e0e0;">${fireStartTime || "-"}</span></div>
              <div style="margin-bottom: 6px;"><strong style="color: #ffd700;">🕒 진화일시:</strong> <span style="color: #e0e0e0;">${fireEndTime || "-"}</span></div>
              <div style="margin-bottom: 6px;"><strong style="color: #ffd700;">🔥 진행상태:</strong> <span style="color: #ff6b6b; font-weight: bold;">${status}</span></div>
              <div style="margin-bottom: 6px;"><strong style="color: #ffd700;">🧯 대응단계:</strong> <span style="color: #4fc3f7; font-weight: bold;">${level}</span></div>
              <div><strong style="color: #ffd700;">📊 좌표:</strong> <span style="color: #e0e0e0;">${latitude.toFixed(4)}, ${longitude.toFixed(4)}</span></div>
            </div>
            
            <div style="background: rgba(255, 255, 255, 0.1); padding: 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.2);">
              <h4 style="margin: 0 0 8px 0; color:rgb(255, 255, 255); font-size: 14px;">🌤️ 기상 정보</h4>
              <div style="margin-bottom: 4px;"><strong style="color: #81c784;">🌡️ 기온:</strong> <span style="color: #e0e0e0;">${temp ?? "-"} ℃</span></div>
              <div style="margin-bottom: 4px;"><strong style="color: #81c784;">💨 풍속:</strong> <span style="color: #e0e0e0;">${wspd ?? "-"} m/s</span></div>
              <div style="margin-bottom: 4px;"><strong style="color: #81c784;">🧭 풍향:</strong> <span style="color: #e0e0e0;">${wdir ?? "-"}°</span></div>
              <div style="margin-bottom: 4px;"><strong style="color: #81c784;">☔ 강수량:</strong> <span style="color: #e0e0e0;">${precip ?? "-"} mm</span></div>
              <div><strong style="color: #81c784;">💧 습도:</strong> <span style="color: #e0e0e0;">${rhum ?? "-"} %</span></div>
            </div>
          </div>
        `,
      };

      entities.push(entity);
      count++;

    } catch (error) {
      console.error(`❌ 엔티티 생성 실패:`, error);
    }
  });

  // 배치로 엔티티 추가 (성능 최적화)
  entities.forEach(entityData => {
    viewer.entities.add(entityData);
  });

  updateFireCount(count, stats, startDate, endDate);
  updateStatsSummary(stats, startDate, endDate);
  
  console.log(`🎯 최종 결과: ${count}개 화재 지점 시각화 완료`);
  console.log(`📊 통계:`, stats);

  // 카메라 위치 조정 - 전체 한국 뷰 유지
  if (count > 0) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(127.7669, 35.9078, 1000000), // 높은 고도로 전체 뷰
      duration: 1.5
    });
  }
}

// 화재 개수 및 통계 업데이트
function updateFireCount(count, stats, startDate, endDate) {
  const fireCountDiv = document.getElementById("fireCount");
  if (typeof count === 'number') {
    const total = Object.values(stats || {}).reduce((sum, val) => sum + val, 0);
    fireCountDiv.textContent = `🔥 화재 지점 ${count.toLocaleString()}개 표시됨`;
  } else {
    fireCountDiv.textContent = count;
  }
}

// 통계 요약 업데이트
function updateStatsSummary(stats, startDate, endDate) {
  const statsSummaryDiv = document.getElementById("statsSummary");
  const statsInitial = document.getElementById("statsInitial");
  const statsLevel1 = document.getElementById("statsLevel1");
  const statsLevel2 = document.getElementById("statsLevel2");
  const statsLevel3 = document.getElementById("statsLevel3");
  const statsPeriod = document.getElementById("statsPeriod");

  if (stats && Object.keys(stats).length > 0) {
    statsInitial.textContent = `${stats['초기대응'] || 0}개`;
    statsLevel1.textContent = `${stats['1단계'] || 0}개`;
    statsLevel2.textContent = `${stats['2단계'] || 0}개`;
    statsLevel3.textContent = `${stats['3단계'] || 0}개`;
    
    // 기간 계산
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    statsPeriod.textContent = `${diffDays}일간`;
    
    statsSummaryDiv.style.display = 'block';
  } else {
    statsSummaryDiv.style.display = 'none';
  }
}

// 날짜 범위 필터 설정
function setupDateRangeFilter() {
  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");

  const onRangeChange = () => {
    const startDate = startInput.value;
    const endDate = endInput.value;
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);

    if (sDate > eDate) {
      alert("시작 날짜가 종료 날짜보다 늦을 수 없습니다.");
      return;
    }

    if (sDate < new Date("2024-10-01") || eDate > new Date("2025-04-01")) {
      alert("2024년 10월 1일 ~ 2025년 4월 1일 범위 내에서만 선택 가능합니다.");
      return;
    }

    // 전체 데이터에서 다시 필터링
    const filteredData = allFireData.filter(item => {
      const dateField = item.frfr_frng_dtm || item.start || item.date;
      if (!dateField) return false;
      
      const dataDate = new Date(dateField.split(" ")[0]);
      return dataDate >= sDate && dataDate <= eDate;
    });

    console.log(`🔍 필터링된 데이터: ${filteredData.length}개 (${startDate} ~ ${endDate})`);
    renderFireData(filteredData, startDate, endDate);
  };

  startInput.addEventListener("change", onRangeChange);
  endInput.addEventListener("change", onRangeChange);
}

// 날짜 컨트롤 설정
function setupDateControls() {
  // 마우스 클릭 시 상세 정보 표시
  viewer.screenSpaceEventHandler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    if (Cesium.defined(picked) && picked.id?.description) {
      viewer.selectedEntity = picked.id;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // 마우스 오버 시 정보 팝업 표시
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement) => {
    const pickedObject = viewer.scene.pick(movement.endPosition);
    if (Cesium.defined(pickedObject) && pickedObject.id?.description) {
      document.body.style.cursor = 'pointer';
    } else {
      document.body.style.cursor = 'default';
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
}

// 성능 최적화를 위한 LOD (Level of Detail) 시스템 - 크기 조정
function optimizeEntitiesForZoom() {
  const camera = viewer.camera;
  const height = camera.positionCartographic.height;
  
  // 높이에 따라 점 크기와 투명도 조정 (더 큰 기본 크기)
  const entities = viewer.entities.values;
  entities.forEach(entity => {
    if (entity.point) {
      if (height > 2000000) { // 매우 높은 고도
        entity.point.pixelSize = Math.max(entity.point.pixelSize._value * 0.7, 8);
        entity.point.color = entity.point.color._value.withAlpha(0.7);
      } else if (height > 1000000) { // 높은 고도
        entity.point.pixelSize = Math.max(entity.point.pixelSize._value * 0.85, 10);
        entity.point.color = entity.point.color._value.withAlpha(0.85);
      }
      // 낮은 고도에서는 원래 크기와 투명도 유지
    }
  });
}

// 카메라 이동 시 최적화 적용
let optimizeTimeout;
function setupPerformanceOptimization() {
  viewer.camera.changed.addEventListener(() => {
    clearTimeout(optimizeTimeout);
    optimizeTimeout = setTimeout(optimizeEntitiesForZoom, 100);
  });
}

// 월별 데이터 통계 계산
function calculateMonthlyStats() {
  const monthlyStats = {};
  
  allFireData.forEach(item => {
    const dateField = item.frfr_frng_dtm || item.start || item.date;
    if (!dateField) return;
    
    const dataDate = new Date(dateField.split(" ")[0]);
    const monthKey = `${dataDate.getFullYear()}-${String(dataDate.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = 0;
    }
    monthlyStats[monthKey]++;
  });
  
  console.log("📊 월별 화재 통계:", monthlyStats);
  return monthlyStats;
}

// 환경설정 및 초기화
fetch("/api/config")
  .then((res) => res.json())
  .then((config) => {
    Cesium.Ion.defaultAccessToken = config.cesiumToken;
    Cesium.GoogleMaps.defaultApiKey = config.googleKey;
    init();
    setupPerformanceOptimization();
  })
  .catch((err) => {
    console.error("❌ config 불러오기 실패:", err);
    // config 없이도 실행 가능하도록 기본 설정
    init();
    setupPerformanceOptimization();
  });

// 전역 함수로 빠른 선택 기능 제공
window.setQuickRange = function(startDate, endDate) {
  document.getElementById('startDate').value = startDate;
  document.getElementById('endDate').value = endDate;
  
  // 필터링된 데이터로 렌더링
  const filteredData = allFireData.filter(item => {
    const dateField = item.frfr_frng_dtm || item.start || item.date;
    if (!dateField) return false;
    
    const dataDate = new Date(dateField.split(" ")[0]);
    return dataDate >= new Date(startDate) && dataDate <= new Date(endDate);
  });
  
  renderFireData(filteredData, startDate, endDate);
};