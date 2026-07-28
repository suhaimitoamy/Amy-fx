# Amy FX Honesty Backtest — Historical Data Gate Failure

Date: 2026-07-28

Branch: `personal/amyfx-private`

Replay status: **BLOCKED**

This report supersedes the earlier data `PASS` statement. The earlier validator checked normalized OHLC integrity and uniqueness, but it did not reject source-order reversals, timezone-naive timestamps, incomplete M1 buckets, or irregular missing H1 blocks.

## Dataset

- 72 monthly XAU/USD ZIP archives
- January 2020 through December 2025
- M1, M5, M15, H1, H4, D1
- Raw rows: 2,682,099
- Unique normalized rows: 2,681,643
- 2026 rows admitted: 0
- Conflicting OHLC duplicates: 0

## Blocking anomalies

### 1. Source timezone is not verifiable

All 2,682,099 source timestamps are timezone-naive. The CSV files do not contain a UTC offset or timezone identifier. A timezone must not be invented because it would affect candle close time, HTF availability, and Asia/London/New York session classification.

### 2. Source rows are not strictly chronological

The raw files contain 18 non-monotonic transitions. They come from repeated blocks in October 2020 through 2025.

The repeated blocks contain 456 exact duplicate candles:

- M1: 60 duplicate rows per October archive
- M5: 12 duplicate rows per October archive
- M15: 4 duplicate rows per October archive

The OHLC values are identical, so exact deduplication is deterministic. The raw source still fails the ordering gate and must be reported rather than silently accepted.

### 3. Irregular H1 blocks are missing

The stricter validator found 480 two-hour jumps that are not part of the recurring maintenance schedule inferred across at least four different years.

Breakdown:

- 2020-08: 1
- 2023-01: 3
- 2023-02: 34
- 2023-03: 78
- 2023-04: 77
- 2023-05: 101
- 2023-06: 99
- 2023-07: 87

Minimal reproduction:

- H1 2023-02-20 04:00 exists.
- H1 2023-02-20 05:00 is absent.
- H1 2023-02-20 06:00 exists.
- The M1, M5, and M15 candles for 05:00–05:59 are also absent.
- The H4 candle beginning 04:00 still exists.

This is not treated as a no-tick minute. A complete active-market hour is missing simultaneously from M1, M5, M15, and H1.

### 4. M1 coverage inside native M5 is incomplete

- Complete M5 buckets with five M1 candles: 415,759
- Incomplete native M5 buckets: 470
- Absent M1 minute slots: 605

Without source metadata, these slots cannot be certified as legitimate no-tick intervals. Intrabar ordering around them must not be treated as fully observed.

## Validator correction

Before:

- normalized OHLC and uniqueness could produce `PASS` despite source-order, timezone, and coverage defects.

After:

- timezone-naive source rows fail the gate;
- non-monotonic source rows fail the gate;
- irregular H1 holes fail the gate;
- incomplete M1 coverage inside a native M5 candle fails the gate;
- exact duplicates remain counted separately from conflicting OHLC duplicates.

## Regression tests

Added tests for:

1. exact duplicate without duplicate database row;
2. conflicting OHLC duplicate;
3. timezone-naive timestamp;
4. repeated/non-monotonic source block;
5. irregular missing H1 block;
6. incomplete M1 bucket inside native M5.

All six tests pass locally.

## Gate decision

**FAIL — do not start full replay.**

No Direction Forecast accuracy, setup win rate, profit factor, expectancy, drawdown, or trading result is produced from this dataset state.

The replay can resume only after the historical source is replaced or independently repaired with documented provider/timezone provenance and complete candle coverage. The repaired source must receive new archive hashes and pass the full data gate from the beginning.
