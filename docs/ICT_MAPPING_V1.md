# Pro337 — ICT Mapping replacement

The public Mapping entry now loads only `js/ict-workspace/app.js`, its pure
engine/data modules, the existing chart library, theme controller and notification
route/scanner-retirement adapters. No legacy analytical or UI-repair authority loads.
`legacy-index.html` preserves the prior page for explicit archived regression coverage;
there is no link to it from the new page. Existing Scalper history remains a separate
service/model. Its push notifications are not signals from the new ICT model.

## Operational definition

This is an ICT-inspired, explicitly specified engineering model, not an official ICT
algorithm. The conceptual source is Michael Huddleston's ICT mentorship; the official
channel is https://www.youtube.com/@InnerCircleTrader. This session could verify the
channel but could not obtain episode transcripts; exact threshold attribution is not
claimed. All numeric thresholds below are this implementation's choices.

- XAU/USD; H1 structural context and M5/M15 entry, with symmetric BUY/SELL rules.
- Strict two-left/two-right pivots. A close through previously untouched confirmed H1
  swing changes context; location alone does not create a bias. Range is the latest
  confirmed high/low, and midpoint is descriptive until entry location validation.
- Sweep: penetrate a previously untouched local pivot and close back through it.
  The opposite structural pivot must already exist before the sweep.
- Later displacement closes through that opposite pivot: body >=0.8 prior ATR14,
  body/range >=0.60. The MSS candle must be the middle of a three-candle FVG.
- Entry midpoint FVG inside H1 range, in discount for BUY/premium for SELL. Stop
  beyond sweep wick +0.15 ATR. Target nearest untouched opposing local liquidity;
  reject below 2R, never skip it to inflate RR with a more distant target.
- Sessions: London 02:00–05:00, New York 07:00–10:00, America/New_York with DST.
- Pending expiry 12 bars; simulated holding limit 48 bars; no breakeven/partial exit.
- Minimum 40 entry candles and 30 H1 candles before candidate construction.
- No future/forming/synthetic data, no gap filling. Conflicting duplicate OHLC fails.
  Data gaps cancel pending/active simulations as unknown and retire old liquidity.
- Fills are simulated only on later candles. Fill + target on one bar is ambiguous;
  fill + stop loses, active stop + target loses. Gaps through stop use worse open.
- Failed/stale data forces WAIT. An ACTIVE replay fill is management context, not a
  new entry instruction. Level geometry never follows current ticks.

## Integration and validation

The existing Twelve Data proxy is retained; fetches are single generation-owned pairs
with abort, 20-second timeout, and visible-page 60-second refresh. No API credential is
introduced. Native legacy scanner is retired; the workspace submits no broker orders.
New snapshot/event: `AmyICTMapping` / `amyfx:ict-mapping-updated`; old incompatible
forecast and Entry Watch fields are not populated.

`tests/ict-workspace.test.mjs` owns current production coverage, including positive
BUY/SELL sequences, causal prefix invariance, gap/staleness, expiry, conservative fills,
nearest-target rejection, provider errors and actual production asset/authority wiring.
Prior page-contract tests explicitly target the archived Pro336 page; no test runner
or CI gate is disabled. Full 125-file JavaScript suite passed locally before final
focused changes; focused tests run again afterward. CI runs the complete suite.

Cloud Browser rejected local preview with ERR_BLOCKED_BY_CLIENT. Visual mobile and
real-device WebView checks remain unverified. No historical profitability study was
completed. Displayed R is gross simulation in the loaded 300-bar window, not net
expectancy; spread/commission/slippage and news are not modeled. Do not present old
Scalper backtests or fixtures as performance evidence for this model. Forward paper
validation and an independently held-out, broker-cost-aware backtest are still needed.

Source advances to 2.0.0-pro.337 / 950337. Preserve published update.json until existing
signed build, signer continuity, APK checksum and published endpoint gates activate it.
