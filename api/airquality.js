// api/airquality.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export default async function handler(req, res) {
  const { lat, lon, start, end } = req.query;

  if (!lat || !lon || !start || !end) {
    return res.status(400).json({ error: 'lat, lon, start, end 다 필요함!' });
  }

  try {
    console.log("📍 Weatherbit 요청", { lat, lon, start, end });

    const response = await axios.get(`https://api.weatherbit.io/v2.0/history/airquality`, {
      params: {
        lat,
        lon,
        start_date: start,
        end_date: end,
        key: process.env.WEATHERBIT_KEY,
      },
    });
    //console.log("✅ WEATHERBIT KEY:", process.env.WEATHERBIT_KEY); 

    if (!response.data || !response.data.data || response.data.data.length === 0) {
      return res.status(404).json({ error: 'Weatherbit에서 데이터 없음' });
    }

    res.status(200).json(response.data);
  } catch (error) {
    console.error('🔥 Weatherbit API 실패:', error.message);
    res.status(500).json({ error: 'Weatherbit 요청 실패!' });
  }
}
