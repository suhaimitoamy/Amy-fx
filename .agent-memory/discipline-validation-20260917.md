# Discipline validation — 2026-09-17

Branch: audit/discipline-validation-20260917, baseline 39bda60f.
Scope: user approved local validation/testing only. No strategy edits, commit, push or deployment.

## Executed
- Refetched public scalper-setups with history=all, history_limit=2000: snapshot generatedAt 2026-09-17T04:14:00.147Z, scope null, preview_simulation.
- 168 unique global history rows: TP56, SL77, BE6, TIME_EXIT10, CANCELLED16, INVALIDATED3. User's TP57 remains unresolved; public global response is not per-device history.
- Discipline: 23 rows = 14 SL + 9 cancelled, no TP. TF: M15 8SL/7cancel; H1 5SL/2cancel; H4 1SL. This arithmetic is correct, not an engine count bug.
- Initial-risk target medians: M15 12.1176R (8), H1 7.0333R (5), H4 4.8661R (1). Uses initialStopLoss, not moved stopLoss.
- Added scripts/audit-discipline-history.py, read-only audit with synthetic unit checks explicitly separated from market evidence. Self-check passed; real snapshot calculation executed successfully.
- Existing node --test tests/discipline-device.test.mjs: 8 passed, 0 failed. These prove present contracts, not profitability.

## Replay availability/blockers
- Tested public Vercel candle proxy interval=1min/outputsize=5000; 5000 non-sentinel closed rows, oldest 2026-09-13T16:55:00Z, newest 2026-09-17T04:14:00Z. Probe returned source=twelvedata, PROVIDER_DIRECT. Recent proxy does not expose start/end forwarding (api/twelvedata.js 117,141-146).
- 14 losing Discipline signals span Sep8–Sep15 across M15/H1/H4. The observed M1 window misses Sep8–11, therefore a full 14-trade replay is not yet possible with that retrieved window. This is not a claim that older data is unavailable everywhere.
- Need original historical M1 plus sufficient M5/M15/H1/H4 warmup and matching deployed version for causal replay. No replay or profitability improvement claimed.
- Current local detector/lifecycle last changed by commit 383b83fb (Sep5); no evidence yet of exact deployed commit for each trade.

## Hypotheses, not proven causes
- Detector already enforces closed H4 EMA20 direction; do not add another H4 filter by assumption.
- Sweep/break + touch retest does not explicitly require subsequent M5 MSS/displacement; confirmation experiment needs fixed definitions before evaluation.
- Eight SL share entry4401.02104, three share4353.83847. Repeated prices are correlated exposure evidence, not proof of identical market events or duplicate-record bug.
- Candidate ID includes TF and signal time; event-level dedup/cooldown requires event definition, not rounding prices indiscriminately.
- Compare confirmation, dedup and 2R target experiments separately; hold out another period and include costs before adopting any change.

Existing untracked mapping-signal-conflict-investigation.md left untouched.
