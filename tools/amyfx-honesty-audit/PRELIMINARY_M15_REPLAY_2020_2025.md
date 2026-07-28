# Preliminary M15 Validated-Forecast Replay — 2020–2025

Status: **completed as a parity-port diagnostic; direct full-app JavaScript replay remains pending**

This is the first chronological diagnostic pass after the historical input-data gate passed. The replay ports the rules in `validated-market-context.js` into an independent Python implementation and applies them to the normalized M15 and H4 candles.

It is deliberately not described as a final backtest because it does not yet execute every Amy FX Mapping module, Entry Watch lifecycle, Pine reference, spread, slippage, or trade execution model.

## Scope

- M15 candles: 138,750
- H4 candles: 9,555
- New Direction Forecast events: 248
- Bullish events: 126
- Bearish events: 122
- Hard lifecycle/no-future-H4 anomalies: 0

## Fixed-horizon directional accuracy

Accuracy here means only that price was in the forecast direction at a fixed future candle. It is not trade win rate and does not include entry, SL, TP, spread, commission, or slippage.

| Horizon | Approximate time | Eligible events | Directional accuracy |
|---|---:|---:|---:|
| 16 M15 bars | 4 hours | 248 | 50.00% |
| 48 M15 bars | 12 hours | 248 | 50.81% |
| 96 M15 bars | 24 hours | 248 | 50.00% |
| 192 M15 bars | 48 hours | 248 | 56.05% |

At 192 bars, mean directional movement was +4.207 and median directional movement was +2.865 in XAU/USD price units.

## 48-hour result by year

| Year | Events | Directional accuracy |
|---|---:|---:|
| 2020 | 34 | 41.18% |
| 2021 | 42 | 52.38% |
| 2022 | 43 | 58.14% |
| 2023 | 40 | 65.00% |
| 2024 diagnostic | 49 | 55.10% |
| 2025 locked validation | 40 | 62.50% |

## First honesty correction

The engine profile used a display value such as `confidence: 60`, while the engine contract itself states that this value is not a live win probability. Presenting it as `60%` could therefore be mistaken for a calibrated probability.

The private Preview runtime now renders this as:

`VALIDATED FORECAST · SCORE 60/100`

The score remains available for context, but the percent sign is removed. A regression test now verifies this behavior.

## Interpretation

The preliminary result does not prove that Amy FX is profitable or unprofitable. It establishes three narrower findings:

1. The ported M15 forecast lifecycle did not use future H4 candles in this pass.
2. The 60 display value must not be represented as a 60% live win probability.
3. The 2025 fixed-horizon result is promising enough to continue auditing, but it must survive the direct JavaScript replay, Entry Watch execution rules, costs, and Pine-reference comparison.

## Next gate

The next gate runs the actual JavaScript engine chronologically and compares each candle against the selected Pine references. The process stops at the first semantic difference, preserves a minimal reproduction window, fixes the defect on `personal/amyfx-private`, and reruns the affected window plus all regressions.
