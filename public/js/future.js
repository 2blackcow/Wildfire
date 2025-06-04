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
    destination: Cesium.Cartesian3.fromDegrees(127.7669, 35.9078, 600000.0),
  });

  addSimpleGuide();
}

// 단순 안내 박스
function addSimpleGuide() {
  const guide = document.createElement("div");
  guide.id = "guideBox";
  guide.style.position = "absolute";
  guide.style.top = "10px";
  guide.style.left = "10px";
  guide.style.padding = "10px 14px";
  guide.style.background = "rgba(0,0,0,0.5)";
  guide.style.color = "white";
  guide.style.fontSize = "13px";
  guide.style.borderRadius = "8px";
  guide.style.zIndex = "100";
  guide.innerHTML = `
    <b>🔥 대한민국 화재 예측 시뮬레이션</b><br/>
    향후 예측 결과 및 기상 데이터 기반 시각화 예정<br/>
    (Cesium 기반 인터페이스 구축됨)
  `;
  document.body.appendChild(guide);
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
