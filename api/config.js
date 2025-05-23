export default function handler(req, res) {
  res.status(200).json({
    cesiumToken: process.env.CESIUM_TOKEN,
    googleKey: process.env.GOOGLE_MAPS_KEY,
  });
}
