# Amy FX Honesty Backtest — Source Provenance and Timezone Recovery

Date: 2026-07-28

Branch: `personal/amyfx-private`

Replay status: **BLOCKED**

## Purpose

This stage determines the historical provider, restores the correct timestamp interpretation, and decides whether the 2020–2025 archives can pass the replay data gate without inventing candles.

## Provenance result

The supplied monthly XAU/USD M1 files for 2020–2024 were concatenated in calendar order and compared row-for-row against independently obtained annual HistData Generic ASCII archives.

| Year | Supplied rows | Official rows | Sequence | Timestamp/OHLC differences |
|---|---:|---:|---|---:|
| 2020 | 354,351 | 354,351 | Exact | 0 |
| 2021 | 353,446 | 353,446 | Exact | 0 |
| 2022 | 354,628 | 354,628 | Exact | 0 |
| 2023 | 308,812 | 308,812 | Exact | 0 |
| 2024 | 355,652 | 355,652 | Exact | 0 |

The comparison includes the October repeated timestamp blocks and the large 2023 gaps. Therefore, those anomalies came from the upstream HistData files and were not introduced by the user's monthly packaging or higher-timeframe aggregation.

The public comparison archive set currently ends at 2024. The 2025 supplied M1 sequence has the same field precision, session boundaries, naming lineage, and fixed-time convention, but no independent annual archive was available for an exact comparison. Its provenance remains `INFERRED`, not `VERIFIED`.

## Correct time interpretation

HistData Generic ASCII timestamps use fixed Eastern Standard Time without daylight-saving adjustment.

The source manifest now declares:

- provider: `HistData.com`;
- instrument: `XAUUSD`;
- quote basis: bid;
- source timezone: `UTC-05:00`;
- DST policy: fixed offset, no DST.

The old ingestion path treated timezone-naive timestamps as UTC. That was incorrect by five hours.

Example:

- source: `2020-01-01 18:00:00` EST;
- corrected normalized time: `2020-01-01T23:00:00Z`;
- equivalent WITA: `2020-01-02 07:00:00+08:00`.

No price was changed. Only the interpretation of the source clock was corrected.

## Exact duplicate handling

The official HistData sequence contains 456 exact duplicate candles across October 2020–2025 and 18 backward timestamp transitions.

All 18 backward transitions point into exact duplicate blocks:

- unsafe unique/conflicting out-of-order rows: 0;
- conflicting OHLC duplicates: 0.

The source manifest explicitly permits deterministic exact dedupe. The normalized database retains one candle per `(timeframe, timestamp)` and records the removed rows. It does not reorder or synthesize prices.

Raw-order status is now `REPAIRED_BY_EXACT_DEDUPE`, not a silent pass.

## Remaining source defects

Correct provenance and timezone do not repair missing market observations.

The full revalidation still finds:

- 480 irregular missing H1 hours;
- 470 native M5 candles with incomplete M1 coverage;
- 605 absent M1 minute slots;
- 0 conflicting OHLC rows;
- 0 admitted 2026 rows.

The 480 missing H1 hours remain concentrated in:

- 2020-08: 1;
- 2023-01: 3;
- 2023-02: 34;
- 2023-03: 78;
- 2023-04: 77;
- 2023-05: 101;
- 2023-06: 99;
- 2023-07: 87.

These missing hours also exist in the official 2023 HistData annual file. They are upstream source gaps. They must not be filled with interpolation or fabricated candles.

## Validator changes

The historical data validator now:

1. reads an explicit source manifest;
2. converts fixed-offset source timestamps to UTC before storage;
3. keeps timezone verification separate from provider provenance;
4. records verified and inferred years separately;
5. permits exact dedupe only when explicitly authorized;
6. rejects unique or conflicting out-of-order rows;
7. rebuilds the SQLite database on every ingest for deterministic reruns;
8. reports source timezone, manifest hash, quote basis, DST policy, and provenance coverage;
9. continues to fail on missing H1/M1 coverage.

## Regression and full-run result

Regression tests: **11 passed**.

Full dataset:

- archives: 72;
- unique normalized rows: 2,681,643;
- source time interpretation: `VERIFIED`;
- raw order: `REPAIRED_BY_EXACT_DEDUPE`;
- unsafe non-monotonic rows: 0;
- externally verified years: 2020–2024;
- unverified year: 2025;
- final verdict: `FAIL`.

## Gate decision

**Do not start replay.**

The source identity and clock are now known for 2020–2024, and the timezone bug is fixed. The data gate remains closed because:

1. material candle gaps remain in the official source; and
2. 2025 has not been independently exact-matched.

No Direction Forecast accuracy, win rate, profit factor, expectancy, drawdown, or profit result is produced at this stage.
