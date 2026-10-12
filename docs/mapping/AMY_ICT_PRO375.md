# AMY ICT Mapping Pro375

Dashboard V2 M15 owns bias, locked invalidation, event-anchored range, pivot liquidity,
fresh/old/invalid sweep, DOL and nearest same-bias OB/FVG. M5 closed candles own
trigger, rejection and entry scoring. H1 remains additional context, not a direction veto.
The backend and Android asset share the byte-identical `amy-ict` module; synchronize
with `node tools/sync-amy-ict.mjs` and verify with `--check`.

`context.amy` carries dashboard, trigger, dual BUY/SELL scoring, historical markers,
key levels, pivots, ICT base reference objects and the closed chart candles actually
used by the engine. All displays consume this same snapshot. Display toggles cannot
change the authoritative bias or score. M1/M5 visual reference objects use the same
portable base algorithm; those objects never become a second decision authority.

## Implemented visual layers

- MSS/BOS from the ICT base zigzag, displacement markers and body/wick OB origin.
- FVG and **Implied** FVG (the pasted `IFVG` option does not mean Inversion FVG),
  touch/break styles, opposing-gap BPR, body-edge Volume Imbalance.
- Buyside/sellside clustered liquidity, OB breaker and polarity changes.
- Friday-close/Monday-open NWOG, previous UTC-day close/open NDOG and midpoints.
- Fibonacci 0, .236, .382, .5, .618, .786, 1, 1.618 with diagonal/vertical anchors.
- Completed daily/weekly/monthly classic pivots P, R1–R4 and S1–S4; All/Clean/Major.
- Exact New York M1 Midnight Open, PDH/PDL, pivot BSL/SSL and NY 20:00–00:00 Asia H/L.
- New York, London Open/Close and Tokyo Asian killzone backgrounds with IANA DST.
- Dashboard header + 15 rows, dual score breakdown, chart narration, Strong/Ready arrows.

## Causal corrections and deliberate differences from the pasted script

1. Every calculation accepts only validated closed candles. The pasted unshifted
   LTF `request.security` can read an unfinished bar; this implementation cannot.
2. A newly formed FVG/OB is **Fresh** on its creation bar. The pasted dashboard
   immediately touches its own zone, so its `Fresh` state is overwritten. A retest
   requires a later candle here.
3. Missing feed bars cannot create a pivot/gap; ATR restarts with sufficient
   contiguous data. Missing Asia coverage or midnight never falls back to an
   arbitrary chart open. Levels are explicitly `UNAVAILABLE` until supported.
4. Daily levels and week/month grouping use the market data provider's UTC D1
   convention. New York Midnight/Asia and exchange-local killzones use their named
   timezones. Broker daily boundaries can differ from TradingView. Weekly/monthly
   pivots need previous completed-period coverage; unavailable data is not invented.
5. Raw BUY/SELL layer sum can reach **110**, although the pasted comment says 105.
   As requested, each direction is capped at 100, with near-invalid × 0.7. Scores
   are **points**, never probabilities. H1 and news do not alter Pine layer weights.
6. News lock, current-week calendar verification, directional active liquidity,
   correct invalidation geometry, M5 break/displacement and favorable location
   remain additional application execution gates. A Strong score alone is not A+.
   Markers require a matching active M15 bias; no fresh context means no overlays.
7. Historical markers evaluate M15/M1 snapshots as of each M5 close, including
   developing Asia levels; today's completed range cannot rewrite yesterday's signal.
8. ICT base objects and AMY dashboard objects are labelled separately because the
   pasted script has different OB/FVG engines. Their geometries need not coincide.
9. DOL reached stays reached for that sweep/target; a later pullback cannot turn
   an already taken target back into active liquidity.
10. Execution geometry checks the latest closed M5 price, not the older M15 close.
    A winning score against the M15 bias is explicitly labelled and cannot create A+.
11. This is a finite replay of loaded history, as on a TradingView loaded chart.
   No claim of exact broker parity or verified profitability is made. Dataset/broker
   differences and the causal corrections above must be included in comparisons.

## Validation

Run `npm test`. Dedicated fixtures cover prefix invariance, pivot tie/confirmation,
feed gaps, locked invalidation, directional authority, dual weights/penalty, NY session
locking and DST, levels, VI/NWOG/NDOG/Fibonacci and browser/backend byte identity.
The browser smoke script uses a mocked closed-candle snapshot, not live trading
results, and checks mobile layout, all controls, chart modes/theme and offline reset.
Actual Android notification receipt and broker-matched TradingView comparison require
observation on the user's device/chart; a local browser check is not that observation.

## Final release Pro376

Signed Pro376/950376 is published and the public update manifest is enabled. Backend
v24 additionally serializes a primary target only for active liquidity matching the
primary side and latest M5 price geometry. An opposing DOL stays in the dashboard
as an observation; it is not a BUY/SELL scenario target. Thirty dedicated cases and
all140 regression files pass. The final serialization-only deployment does not change
the APK assets or its signed identity. Actual device update receipt and broker-matched
TradingView observations remain outside the checks completed in this workspace.
