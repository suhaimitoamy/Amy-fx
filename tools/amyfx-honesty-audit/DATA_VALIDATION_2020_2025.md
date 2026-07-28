# XAU/USD Historical Data Validation — 2020–2025

Status: **PASS**

This report records the first completed input-data gate for the Amy FX honesty replay. It covers the 72 monthly XAU/USD archives supplied in Google Drive. Supplied 2026 archives are excluded.

## Normalized database

- Accepted period: 2020-01-01 through 2025-12-31
- Monthly archives: 72
- Timeframes: M1, M5, M15, H1, H4, D1
- Unique candles: 2,681,643
- Invalid OHLC rows: 0
- Conflicting OHLC rows for the same timeframe/timestamp: 0
- Rejected 2026 rows admitted: 0
- Uniqueness: enforced by primary key `(timeframe, timestamp)`

### Rows by year

| Year | Rows |
|---|---:|
| 2020 | 456,610 |
| 2021 | 460,456 |
| 2022 | 459,897 |
| 2023 | 458,599 |
| 2024 | 461,130 |
| 2025 | 384,951 |

### Rows by timeframe

| Timeframe | Rows |
|---|---:|
| M1 | 2,079,178 |
| M5 | 416,229 |
| M15 | 138,750 |
| H1 | 34,703 |
| H4 | 9,555 |
| D1 | 1,866 |

## Cross-timeframe consistency

Every native higher-timeframe candle was reconstructed from M1 and compared with the supplied higher-timeframe candle. Tolerance was 0.011 to allow the supplied M1 precision of three decimals to round to the higher-timeframe precision of two decimals.

| Timeframe | Compared | Matching | Mismatch | Missing M1 bucket | Match rate |
|---|---:|---:|---:|---:|---:|
| M5 | 416,229 | 416,229 | 0 | 0 | 100% |
| M15 | 138,750 | 138,750 | 0 | 0 | 100% |
| H1 | 34,703 | 34,703 | 0 | 0 | 100% |
| H4 | 9,555 | 9,555 | 0 | 0 | 100% |
| D1 | 1,866 | 1,866 | 0 | 0 | 100% |

Maximum absolute OHLC rounding difference was approximately 0.005 on every timeframe.

## Duplicate archive boundaries

There are 456 exact duplicate rows across archive boundaries: 76 identical rows in each October archive from 2020 through 2025. They contain the same OHLC values and are stored once. They are not conflicts and do not alter replay results.

The importer originally counted an identical conflict-handling update as a newly inserted row and performed an unnecessary full duplicate scan during validation. The importer was corrected to classify:

- newly inserted rows,
- exact duplicates,
- conflicting duplicates.

Validation now fails when conflicting OHLC values exist for the same timeframe and timestamp.

## Gate decision

The candle source passes the input-data gate and is approved for chronological replay. This result validates candle integrity only; it does not yet establish the accuracy or profitability of Amy FX forecasts or setups.
