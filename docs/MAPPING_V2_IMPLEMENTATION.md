# Mapping V2 Experiment

## Tujuan

Mengurangi waktu membaca halaman Analyze dan memberi peringatan lebih awal saat karakter market berubah, tanpa mengganti logika produksi sebelum validasi cukup.

## Komponen

1. `market-regime-engine.js`
   - TRENDING, RANGING, MANIPULATION, EXPANSION, TRANSITION.
   - Market Shift risk dan status.
   - Strategy Router.
   - Output context-only; execution gate dinonaktifkan.

2. `mapping-v2.js`
   - Decision-first card di bagian teratas.
   - Ringkasan tindakan, regime, shift risk, strategi, dan empat bukti utama.
   - Mode Ringkas menyembunyikan seluruh detail lama pada halaman Analyze.
   - Mode Detail Teknis mengembalikan seluruh kartu lama untuk audit.
   - Tidak memakai MutationObserver.

3. `mapping-v2.css`
   - Tata letak satu layar, responsif, dan mempertahankan gaya Dark Premium Amy FX.

## Prinsip Keselamatan

- Tidak mengubah `main`.
- Tidak menghapus Legacy Engine, Concept Engine V2, Entry Map, Outlook, atau kartu lama.
- UI lama tetap tersedia melalui tombol Detail Teknis.
- Regime dan shift tidak memblokir setup otomatis pada tahap eksperimen.
