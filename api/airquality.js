import axios from 'axios';

export default async function handler(req, res) {
  const { lat, lon, start, end } = req.query;

  if (!lat || !lon || !start || !end) {
    return res.status(400).json({ error: 'lat, lon, start, end 다 필요함!' });
  }

  try {
    const response = await axios.get(`https://api.weatherbit.io/v2.0/history/airquality`, {
      params: {
        lat,
        lon,
        start_date: start,
        end_date: end,
        key: process.env.WEATHERBIT_KEY
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error('🔥 Weatherbit API 실패:', error.message);
    res.status(500).json({ error: 'Weatherbit 요청 실패함!' });
  }
}
