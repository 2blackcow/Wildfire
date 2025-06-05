let viewer;

async function init() {
  viewer = new Cesium.Viewer("cesiumContainer", {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    baseLayerPicker: false,
    animation: false,
    timeline: false,
  });

  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.globe.enableLighting = true;

  const provider = new Cesium.UrlTemplateImageryProvider({
    url: "https://stormscdn.ngs.noaa.gov/20250120m-maxar/{z}/{x}/{y}",
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: 19,
    credit: "NOAA MAXAR 2025-01-20",
  });
  viewer.imageryLayers.addImageryProvider(provider);

  const res = await fetch("/fire_archive_SV-C2_616504.json");
  const fireData = await res.json();
  let count = 0;

  fireData.forEach((fire) => {
    if (fire.acq_date !== "2025-01-20") return;

    let color = Cesium.Color.YELLOW.withAlpha(0.7);
    if (fire.confidence === "h") color = Cesium.Color.RED.withAlpha(0.8);
    else if (fire.confidence === "n") color = Cesium.Color.ORANGE.withAlpha(0.8);

    const frp = parseFloat(fire.frp);
    const size = Math.min(Math.max(frp / 8, 8), 20);
    const lat = fire.latitude + (Math.random() - 0.5) * 0.015;
    const lon = fire.longitude + (Math.random() - 0.5) * 0.015;

    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 10),
      point: {
        pixelSize: size,
        color: color,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      description: `
        <b>📅 날짜:</b> ${fire.acq_date}<br/>
        <b>🔥 FRP:</b> ${fire.frp}<br/>
        <b>신뢰도:</b> ${fire.confidence}
      `,
    });
    count++;
  });

  console.log(`✅ 2025-01-20 산불 ${count}개 표시 완료`);

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-118.5, 34.1, 90000),
  });
}

fetch("/api/config")
  .then((res) => res.json())
  .then((config) => {
    Cesium.Ion.defaultAccessToken = config.cesiumToken;
    init();
  })
  .catch((err) => {
    console.error("❌ Cesium 설정 실패:", err);
  });
