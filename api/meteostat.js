// api/meteostat.js
import axios from 'axios';

export default async function handler(req, res) {
  const { lat, lon, start, end } = req.query;

  if (!lat || !lon || !start || !end) {
    return res.status(400).json({ error: 'lat, lon, start, end 파라미터 필요함!' });
  }

  try {
    console.log("📍 Meteostat 요청", { lat, lon, start, end });

    const response = await axios.get('https://meteostat.p.rapidapi.com/point/hourly', {
      params: {
        lat,
        lon,
        start,
        end,
        tz: 'Asia/Seoul',
      },
      headers: {
        'X-RapidAPI-Key': process.env.METEOSTAT_KEY,
        'X-RapidAPI-Host': 'meteostat.p.rapidapi.com',
      },
    });
    //console.log("✅ METEOSTAT KEY:", process.env.METEOSTAT_KEY);

    if (!response.data || !response.data.data || response.data.data.length === 0) {
      return res.status(404).json({ error: 'Meteostat에서 데이터 없음' });
    }

    res.status(200).json(response.data);
  } catch (error) {
    console.error('🌩️ Meteostat API 실패:', error.message);
    res.status(500).json({ error: 'Meteostat 요청 실패함!' });
  }
}
