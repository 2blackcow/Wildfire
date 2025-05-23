import axios from 'axios';

export default async function handler(req, res) {
  const { lat, lon, start, end } = req.query;

  if (!lat || !lon || !start || !end) {
    return res.status(400).json({ error: 'lat, lon, start, end 파라미터 필요함!' });
  }

  try {
    const response = await axios.get('https://meteostat.p.rapidapi.com/point/hourly', {
      params: {
        lat,
        lon,
        start,
        end,
        tz: 'Asia/Seoul'
      },
      headers: {
        'X-RapidAPI-Key': process.env.METEOSTAT_KEY,
        'X-RapidAPI-Host': 'meteostat.p.rapidapi.com'
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error('🌩️ Meteostat API 실패:', error.message);
    res.status(500).json({ error: 'Meteostat 요청 실패함!' });
  }
}
