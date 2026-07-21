# Validated Market Context Parity

Branch: `experiment/mapping-regime-engine-20260721`

## Tujuan

Amy FX memakai rule Market State dan Direction Forecast dari `AMY_ICT_NextGen.pine` sebagai sumber utama. Market Regime, Market Shift, dan Strategy Router tetap tersedia sebagai konteks tambahan, tetapi tidak boleh mengganti hasil tervalidasi.

## Rule yang dikunci

### Market State

- Fast swing: 4/4.
- Slow swing: 6/6.
- Toleransi perubahan swing: 0,05 ATR.
- Confirmed bullish membutuhkan fast HH/HL, slow HH/HL, confirmed bullish structure, dan protected fast low masih utuh.
- Confirmed bearish memakai rule kebalikan.
- Pullback hanya dilabeli ketika confirmed trend masih utuh dan fase swing terakhir berlawanan dengan posisi harga terhadap EMA21.
- Struktur ambigu tetap `RANGE / TRANSITION` dan tidak dipaksa menjadi trend.

### Direction Forecast

- M5: MSS + confirmed local Market State + price alignment. Horizon 24 jam, display confidence 65%.
- M15: H4-aligned structural break dari sisi berlawanan range 80 candle. Horizon 48 jam, display confidence 60%.
- H1: bullish structural break + H4/price alignment + momentum tiga candle positif tetapi di bawah 2,5 ATR. Horizon 72 jam, display confidence 65%.
- H1 bearish tetap ditekan karena tidak lolos validasi.
- Forecast dibatalkan oleh opposite confirmed structural break atau expiry.

## Integrasi

- Output disimpan pada `result.validatedMarketContext`.
- Dashboard menampilkan `VALIDATED MARKET CONTEXT` sebelum Regime Context.
- Regime mempunyai authority `CONTEXT ONLY`.
- Setup Strategy Router yang berlawanan dengan Direction Forecast aktif ditahan.
- Direction Forecast tidak diubah menjadi sinyal entry; entry tetap membutuhkan setup tersendiri.

## Validasi lokal 2022–2025

Port rule tanpa tuning ulang kembali menghasilkan directional accuracy di sekitar plateau indikator:

- M5: sekitar 65%.
- M15: sekitar 60%.
- H1 bullish: sekitar 66%.

Hasil ini dipakai sebagai parity check, bukan optimasi parameter baru.

## Proteksi regresi

`tests/validated-market-context-parity.test.mjs` mengunci:

- confirmed trend dan protected swing;
- pullback classification;
- rule M5 dan M15;
- suppression bearish H1;
- batas momentum H1;
- invalidasi forecast oleh opposite break.

`main` tidak diubah.
