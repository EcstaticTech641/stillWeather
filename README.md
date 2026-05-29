# Stillwater Swim Club - Practice Weather Decision Tool

A standalone interactive HTML dashboard widget to help the Stillwater YMCA Swim Club make practice hold/cancel decisions based on real-time National Weather Service (NWS) data.
Access Here - 
https://ecstatictech641.github.io/stillWeather/


## Features
- **Live Realtime NWS Fetching:** The web app reaches out directly to the free NWS APIs (`api.weather.gov`) on load to get the latest hourly forecasts and active county alerts for Stillwater, OK. No external scripts or agentic updates are required!
- **Self-Updating UI:** Includes a "Refresh Data" button that instantly fetches the latest conditions without reloading the entire page.
- **Decision Engine:** Automatically calculates threat scores taking into account specific thresholds for temperature, wind, precipitation, and the YMCA lightning policy.
- **Interactive UI:** A responsive, dark-mode compatible design matching flat white cards and green/amber/red status pills.

## Usage
Simply open `index.html` in any web browser. The app will automatically query the National Weather Service, parse the incoming JSON payload, calculate group-specific risk profiles, and build the hourly timeline based on the fixed 60-minute travel time constraint.

## Logic Overview
- Decisions are split into Morning and Evening windows.
- "Decide by" deadlines are fixed at 60 minutes before the first scheduled practice of the group.
- **Threat Score (0-100):**
  - Severe Warning: Auto-set to minimum 70.
  - Tornado Warning: Auto-set to 100 (Cancel).
  - Thunder/T-Storms in forecast: +40 points (factors in YMCA 30-minute lightning clearance).
  - Points scaled heavily for precipitation probability and wind gusts.
  - Overall status based on max threat score during the travel + practice window:
    - 0-39: Hold
    - 40-59: Monitor (Low)
    - 60-84: Monitor (High)
    - 85+: Cancel
test
