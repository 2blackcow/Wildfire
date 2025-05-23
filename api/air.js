// api/air.js
export default async function handler(req, res) {
  const { lat, lon } = req.query;
  const key = process.env.IQAIR_KEY;

  if (!lat || !lon) return res.status(400).json({ error: "Missing coordinates" });

  try {
    const response = await fetch(`https://api.airvisual.com/v2/nearest_city?lat=${lat}&lon=${lon}&key=${key}`);
    const data = await response.json();
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: "API request failed" });
  }
}
