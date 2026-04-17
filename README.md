# Stillwater Swim Club - Practice Weather Decision Tool

An interactive HTML dashboard widget to help the Stillwater YMCA Swim Club make practice hold/cancel decisions based on National Weather Service (NWS) data.

## Features
- **NWS Data Fetching:** A Python script `fetch_parse.py` fetches the current tabular hourly forecast and active alerts for Stillwater, OK (from NWS API endpoints).
- **Dashboard Generation:** A script `build_widget.py` reads the fetched data and injects it into a standalone interactive HTML dashboard.
- **Decision Engine:** Automatically calculates threat scores taking into account specific thresholds for temperature, wind, precipitation, and the YMCA lightning policy.
- **Interactive UI:** A responsive, dark-mode compatible design matching flat white cards and green/amber/red status pills.

## Usage
1. Run `python fetch_parse.py` to retrieve the latest weather data (outputs `weather_data.json`).
2. Run `python build_widget.py` to bake the updated JSON data directly into `index.html`.
3. Open `index.html` in any web browser.

## Logic Overview
- Decisions are split into Morning and Evening windows.
- "Decide by" deadlines are driven by a user-controlled slider (defaults to 60 minutes before the first scheduled practice of the group).
- **Threat Score (0-100):**
  - Severe Warning: Auto-set to minimum 70.
  - Tornado Warning: Auto-set to 100 (Cancel).
  - Thunder/T-Storms in forecast: +40 points (factors in YMCA 30-minute lightning clearance).
  - Points scaled heavily for precipitation probability and wind gusts.
  - Overall status based on max threat score during the travel + practice window:
    - 0-19: Hold
    - 20-44: Monitor
    - 45+: Cancel
