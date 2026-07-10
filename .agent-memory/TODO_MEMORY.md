# TODO Memory

## Pending Tasks

- [ ] Add real passcode gate for Academy admin (`auth.js` is still a stub).
- [ ] Replace hardcoded `API_BASE` with relative `/api` path if safe (needs WebView testing).
- [ ] Add TwelveData error handling — check `data.status === "error"` in `api/heatmap.js`, `api/liquidity.js`, `api/twelvedata.js`.
- [ ] Add clearer news scraping failure message if Telegram extraction returns empty (diagnostic info).
- [ ] Add defensive WebView fallback for Telegram regex changes (only if primary regex starts failing).

## Notes

- Auth fix needs user decision: what passcode to use.
- API_BASE fix needs WebView testing — `file://` protocol doesn't support relative API paths.
- TwelveData error handling is the safest fix to implement first.
