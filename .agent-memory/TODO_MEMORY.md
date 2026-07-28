# TODO Memory

## Pending Tasks

- [ ] Manually validate Mapping Accuracy V3 on current/forward closed candles for M1, M5, M15, M30, H1, H4, D1, and W1 using `docs/MAPPING_ACCURACY_V3_MANUAL_VALIDATION.md`.
- [ ] Record repeatable reference mismatches with timeframe, candle open time, expected event, actual event, and screenshot before changing any Mapping V3 threshold.
- [ ] Add real passcode gate for Academy admin (`auth.js` is still a stub).
- [ ] Replace hardcoded `API_BASE` with relative `/api` path if safe (needs WebView testing).
- [ ] Add TwelveData error handling — check `data.status === "error"` in `api/heatmap.js`, `api/liquidity.js`, `api/twelvedata.js`.
- [ ] Add clearer news scraping failure message if Telegram extraction returns empty (diagnostic info).
- [ ] Add defensive WebView fallback for Telegram regex changes (only if primary regex starts failing).

## Notes

- Mapping V3 manual profiles (M1, M30, H4, D1, W1) have no win-probability claim and must not be tuned from isolated live outcomes.
- H1 bearish suppression is intentional reference parity, not a pending defect.
- Auth fix needs user decision: what passcode to use.
- API_BASE fix needs WebView testing — `file://` protocol doesn't support relative API paths.
- TwelveData error handling is the safest fix to implement first.
