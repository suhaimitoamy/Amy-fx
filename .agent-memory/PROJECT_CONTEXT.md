# Project Context — Amy FX

## Overview

Amy FX adalah aplikasi **hybrid trading** yang terdiri dari:

- **Android app** berbasis WebView (Kotlin) — semua halaman ditampilkan di dalam WebView
- **Halaman web lokal** (HTML/CSS/JS) — disimpan di `app/src/main/assets/`
- **Backend serverless** di **Vercel** — folder `api/` berisi fungsi JS kecil

## Arsitektur

```
Android (Kotlin) → WebView → load file HTML lokal dari assets
                           → fetch data dari Vercel serverless API
```

- **Mapping & Scanner** konek langsung dari HP ke TwelveData/Supabase (TIDAK lewat Vercel)
- **Market Intel** (News, Heatmap, Liquidity) lewat Vercel serverless API

## Struktur Folder Utama

### Android (Kotlin)
- `app/src/main/java/com/amyelitesuite/` — otak Android (MainActivity, ScannerService, dll)

### Halaman Web (Assets)
- `app/src/main/assets/index.html` — Dashboard utama
- `app/src/main/assets/apps/academy/` — Amy Trading Academy (materi belajar + admin editor)
- `app/src/main/assets/apps/market-intel/` — News + Heatmap + Liquidity Tracker
- `app/src/main/assets/apps/mapping/` — Mapping ICT (rules engine)
- `app/src/main/assets/apps/journal/` — Jurnal trading
- `app/src/main/assets/apps/indikator/` — Library Pine Script indikator

### Backend Serverless (Vercel)
- `api/news.js` — scrape Telegram SM_News_24h → filter keyword gold/XAU → translate ke Bahasa Indonesia
- `api/heatmap.js` — ambil candle dari TwelveData → deteksi swing → hitung zona liquidity heatmap
- `api/liquidity.js` — ambil candle → deteksi swing high/low aktif → track BSL/SSL yang belum di-sweep
- `api/twelvedata.js` — proxy umum ke TwelveData API

### Konfigurasi
- `vercel.json` — setting CORS untuk semua endpoint /api/*
- `.env.local` — environment variables (JANGAN simpan di memory)

## Market Intel

Market Intel punya 3 tab:
1. **News** — berita dari Telegram, diterjemahkan ke Bahasa Indonesia
2. **Heatmap** — zona liquidity berdasarkan clustering swing high/low
3. **Liquidity** — swing tracker BSL/SSL aktif, diurutkan berdasarkan jarak ke harga sekarang

## Academy

- Halaman admin tersedia di `apps/academy/admin/index.html`
- Auth (`auth.js`) saat ini masih **stub** — belum ada proteksi login sungguhan
- WebView Android membutuhkan path explicit (`admin/index.html`, bukan `admin/`)

## Data Flow

| Data | Sumber | Lewat |
|------|--------|-------|
| Harga real-time (Scanner) | TwelveData WebSocket | Langsung dari HP (Kotlin) |
| Candle historis (Mapping) | Supabase | Langsung dari HP (Kotlin) |
| News | Telegram SM_News_24h | HP → api/news.js (Vercel) |
| Heatmap | TwelveData REST | HP → api/heatmap.js (Vercel) |
| Liquidity | TwelveData REST | HP → api/liquidity.js (Vercel) |
