DEREDZ SIGNAL BOT UV — FINAL (GodMode)
Files included:
- index.html
- style.css
- app.js
- manifest.json
- service-worker.js
- icons/icon-192.png
- icons/icon-512.png

Notes:
- Your Twelve Data API key has been embedded directly into app.js as requested.
- The bot auto-selects 2 assets (from payouts API if provided, otherwise first 2 of watchlist).
- Signals require >=90% confidence to be emitted. If none meet this threshold, no signal is shown that cycle.
- Signals run every 5 minutes (300s). Place trades on IQ Option manually with 5-minute expiry when a signal appears.
- To change asset list or payouts API, edit index.html inputs after deployment.
- Test carefully with small stakes first.
