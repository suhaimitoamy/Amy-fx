# Amy FX Honesty Backtest — Stage 3: 2025 Verification and Full Gate Rerun

Date: 2026-07-28

Branch: `personal/amyfx-private`

Replay status: **BLOCKED**

## TAHAP

Tahap 3 — Verifikasi independen XAU/USD 2025 dan rerun seluruh data gate 2020–2025.

## STATUS

**FAIL — provenance PASS, full data gate FAIL, replay tidak dijalankan.**

## TEMUAN

### 1. Provenance 2025 berubah menjadi VERIFIED

Annual HistData Generic ASCII M1 Bid archive untuk XAUUSD tahun 2025 diunduh secara independen melalui alur resmi HistData.

Hasil pembandingan:

- Official archive bytes: `4,561,311`
- Official archive SHA-256: `dd0b4dc6983c07fafd89ba83b0c7f514aa16977654eaeb4c9fc8884ed359d98e`
- Official CSV: `DAT_ASCII_XAUUSD_M1_2025.csv`
- Official rows: `354,011`
- Monthly-source canonical rows: `354,011`
- Official canonical SHA-256: `fea6f4d4407ea80c0b5a4556288c0d156d7ed17da98e81991779f8ba53cf45c4`
- Monthly-source canonical SHA-256: `fea6f4d4407ea80c0b5a4556288c0d156d7ed17da98e81991779f8ba53cf45c4`
- Result: `EXACT_MATCH`

The source manifest now records 2020–2025 as verified and contains no inferred year.

### 2. Full gate was rerun against all original archives

Input:

- 72 original monthly ZIP archives
- January 2020 through December 2025
- 12 archives per year
- 2026 archives excluded
- Source timezone interpreted as fixed `UTC-05:00`, then normalized to UTC

Deterministic rebuild result:

- Source rows: `2,682,099`
- Unique inserted rows: `2,681,643`
- Exact duplicate source rows: `456`
- Conflicting OHLC rows: `0`
- Non-monotonic source transitions: `18`
- Unsafe non-monotonic rows: `0`
- Raw order status: `REPAIRED_BY_EXACT_DEDUPE`
- Bad OHLC rows: `0`
- 2026 rows admitted: `0`
- Provenance complete: `true`
- Verified years present: `2020, 2021, 2022, 2023, 2024, 2025`
- Unverified years present: none

Rows by timeframe:

- M1: `2,080,540`
- M5: `416,229`
- M15: `138,750`
- H1: `34,703`
- H4: `9,555`
- D1: `1,866`

### 3. Blocking data anomalies remain unchanged

Irregular missing H1 blocks: `480`

Breakdown:

- 2020-08: `1`
- 2023-01: `3`
- 2023-02: `34`
- 2023-03: `78`
- 2023-04: `77`
- 2023-05: `101`
- 2023-06: `99`
- 2023-07: `87`

M1 coverage inside native M5:

- Complete M5 buckets: `415,759`
- Incomplete M5 buckets: `470`
- Absent M1 minute slots: `605`

## BUKTI

- The independently downloaded 2025 annual source has the same row count and canonical SHA-256 as the supplied monthly 2025 M1 concatenation.
- The rebuilt database contains all 72 accepted archives and exactly reproduces the Stage 2 aggregate counts.
- The validator reports `provenance_complete=true` and `unverified_years_present=[]`.
- The validator reports `verdict=FAIL` because `irregular_h1_holes.count=480` and `m1_inside_m5.incomplete_buckets=470`.
- No replay, setup scoring, direction scoring, win rate, profit factor, expectancy, drawdown, or profit calculation was executed.

## KESIMPULAN

The 2025 provenance blocker is resolved. XAU/USD 2025 is now independently verified as an exact HistData match.

The historical data gate still fails because the source contains 480 irregular H1 gaps and 470 incomplete native M5 buckets containing 605 absent M1 slots.

Replay remains blocked. No replay result exists.

## LANGKAH BERIKUTNYA

Resolve or replace the missing-candle source coverage with independently documented data. Rerun the complete data gate from the beginning. Start deterministic replay only if every gate returns PASS.
