import requests
res = requests.get(
    "https://api.meteostat.net/v2/point/daily?lat=37.5&lon=127.0&start=2024-05-09&end=2024-05-09",
    headers={"x-api-key": "0e9f3c167emsh8587ec0dcd00fdfp114193jsne0839cdab56d"}
)
print(res.status_code, res.text)
