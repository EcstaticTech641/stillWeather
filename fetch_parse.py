import pandas as pd
import json
import re
import urllib.request
from bs4 import BeautifulSoup

# 1. Fetch 7-day for alerts
url_7day = 'https://forecast.weather.gov/MapClick.php?lat=36.1152&lon=-97.0624'
html_7day = urllib.request.urlopen(url_7day).read().decode('utf-8')
soup_7day = BeautifulSoup(html_7day, 'html.parser')
alerts = []
for a in soup_7day.select('.warnings-title'):
    if a.text.strip():
        alerts.append(a.text.strip())
for alert_box in soup_7day.find_all('a', id=re.compile('wwa[0-9]+')):
    if alert_box.text.strip() and alert_box.text.strip() not in alerts:
        alerts.append(alert_box.text.strip())

# 2. Fetch Hourly Data
urls_to_fetch = [
    'https://forecast.weather.gov/MapClick.php?lat=36.1152&lon=-97.0624&unit=0&lg=english&FcstType=digital',
    'https://forecast.weather.gov/MapClick.php?lat=36.1152&lon=-97.0624&unit=0&lg=english&FcstType=digital&AheadDay=48'
]

all_hours_data = []
row_map = {
    'Date': 'date',
    'Hour (CDT)': 'hour',
    'Hour (CST)': 'hour',
    'Temperature': 'temp',
    'Surface Wind': 'wind_speed',
    'Gust': 'wind_gust',
    'Precipitation Potential': 'pop',
    'Rain': 'rain',
    'Thunder': 'thunder'
}

for url in urls_to_fetch:
    dfs = pd.read_html(url)
    for df in dfs:
        if len(df) <= 10:
            continue
        row_indices = {}
        for idx, row in df.iterrows():
            label = str(row.iloc[0])
            if pd.isna(row.iloc[0]):
                continue
            for key, std_key in row_map.items():
                if key in label:
                    row_indices[std_key] = idx
        
        if 'hour' not in row_indices:
            continue
        
        for col_idx in range(1, df.shape[1]):
            entry = {}
            for std_key, r_idx in row_indices.items():
                val = df.iloc[r_idx, col_idx]
                entry[std_key] = '' if pd.isna(val) else str(val).strip()
            
            if entry.get('hour'):
                all_hours_data.append(entry)

out = {
    'alerts': alerts,
    'data': all_hours_data[:72]
}

with open('weather_data.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2)

print(f"DATA PARSED. Hours: {len(out['data'])}")
