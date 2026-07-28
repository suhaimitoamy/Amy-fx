# Amy FX Honesty Audit

This directory contains the deterministic audit harness used to replay XAU/USD candles and test whether Amy FX labels, forecasts, and setup lifecycle states tell the truth about the data available at that candle.

The harness is intentionally separate from the Android runtime. It does not trade and it does not optimize parameters after seeing validation results.

## Evidence policy

- Accepted research period: 2020-01-01 through 2025-12-31.
- Rejected period: all supplied 2026 candle archives until replaced by broker/API-verified data.
- Development: 2020-2023.
- Diagnostic calibration: 2024.
- Locked validation: 2025.
- Only completed candles may be used to produce a snapshot.
- Future candles may only be used to score the already-locked snapshot.
- Raw FVG, OB, BSL/SSL, bias, structure, and score are observations unless an explicitly named validated claim is active.
- A score such as 97/100 is not a 97% probability.
- A timezone-naive historical source must have a checked-in provenance manifest before ingestion.
- The source manifest must distinguish externally verified years from inferred years.
- Exact duplicates may be removed only when the manifest explicitly permits deterministic dedupe and every non-monotonic row is an exact duplicate. Unique or conflicting out-of-order rows remain fatal.

## Commands

```bash
python tools/amyfx-honesty-audit/run_audit.py ingest \
  --data-dir /path/to/Data-backtest \
  --source-manifest tools/amyfx-honesty-audit/source-manifests/histdata-xauusd-2020-2025.json \
  --db .audit/amyfx-candles.sqlite

python tools/amyfx-honesty-audit/run_audit.py validate-data \
  --db .audit/amyfx-candles.sqlite \
  --report .audit/data-validation.json

python tools/amyfx-honesty-audit/run_audit.py audit-snapshots \
  --input .audit/app-snapshots.jsonl \
  --output .audit/anomalies.jsonl \
  --stop-on-first

python tools/amyfx-honesty-audit/run_audit.py compare \
  --app .audit/app-snapshots.jsonl \
  --reference .audit/reference-snapshots.jsonl \
  --output .audit/differences.jsonl
```

Verify supplied monthly M1 archives against independently obtained annual HistData archives:

```bash
python tools/amyfx-honesty-audit/verify_histdata_source.py \
  --data-dir /path/to/Data-backtest \
  --official-dir /path/to/annual-histdata-archives \
  --years 2020 2021 2022 2023 2024 \
  --output .audit/histdata-source-comparison.json
```

Run tests:

```bash
python -m unittest discover -s tools/amyfx-honesty-audit/tests -v
```

## Immediate-fix workflow

1. Lock the rule and expected output before opening the validation outcome.
2. Replay candles chronologically.
3. Stop at the first anomaly.
4. Save the smallest reproducible candle window and both outputs.
5. Fix only the identified defect on `personal/amyfx-private`.
6. Re-run the failed window, all regression fixtures, then replay from the previous clean checkpoint.
7. Never overwrite the original result. Record before/after engine versions and hashes.

The first full replay requires the 72 monthly archives for 2020-2025. Each archive may contain M1, M5, M15, H1, H4, and D1 CSV files with columns `datetime,open,high,low,close`.
