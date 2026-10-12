# Amy FX Pro

Amy FX Pro adalah **hybrid trading workspace untuk XAU/USD** yang menggabungkan Android WebView, local web modules, market analysis, canonical Mapping, scanner, Market Intel, Trading Academy, Journal, dan Candle Replay.

> Amy FX Pro adalah market-analysis workspace dan decision-support tool. Mapping dibangun dari closed-candle evidence; live price tidak boleh menulis ulang historical Mapping secara sepihak.

## Current Status

| Properti | Nilai |
|---|---|
| Source branch | `main` |
| Candidate source version | `2.0.0-pro.357` / `950357` (PR #5) |
| Active published update | `2.0.0-pro.355` / `950355` |
| Update channel | `main/update.json` |
| Android package continuity | `com.amyelitesuite.learningpreview` |
| Runtime | Android WebView + HTML/CSS/JS + Vercel serverless |

Pro357 disiapkan di cabang review. `main` masih Pro356 dan manifest aktif masih Pro355. Paket Android `com.amyelitesuite.learningpreview` dipertahankan dari baseline `Amy FX Preview` pada `personal/amyfx-private` (`2.0.0-pro.316`) agar pembaruan tetap kompatibel. Kanal pembaruan sumber: `Amy-fx-pro/main/update.json`. APK Pro357 belum diterbitkan.

## Architecture

```text
Android (Kotlin)
  └─ WebView
      ├─ Local HTML/CSS/JS modules
      ├─ Mapping / Scanner → market data + Supabase paths
      └─ Market Intel → Vercel serverless API
```

Struktur utama:

- `app/src/main/java/com/amyelitesuite/` — Android runtime, service, dan WebView bridge.
- `app/src/main/assets/` — seluruh UI/module lokal.
- `app/src/main/assets/apps/mapping/` — canonical Mapping workspace.
- `app/src/main/assets/apps/market-intel/` — News, Heatmap, dan Liquidity.
- `app/src/main/assets/apps/academy/` — Amy Trading Academy dan Trading Practice.
- `app/src/main/assets/apps/journal/` — Journal trading.
- `app/src/main/assets/apps/indikator/` — library indikator/Pine Script.
- `api/` — Vercel serverless endpoints.

## Mapping Gold Pro357

Kandidat Mapping XAU/USD membaca H1 sebagai bias intraday, M15 sebagai area dan kontrol, serta M1 sebagai bukti konfirmasi. Skenario utama dan alternatif berisi alasan, rentang harga, syarat aktivasi, serta batas invalidasi bila tersedia. Semua keputusan memakai candle tertutup; jika data terlambat, status kembali ke **belum siap**. Berita berdampak tinggi belum terhubung ke kalender, sehingga aplikasi meminta pemeriksaan manual.

Mesin setup lama tetap tersedia sebagai arsip tanpa menerbitkan setup baru. Fungsi Supabase produksi masih versi lama sampai perubahan produksi disetujui dan dipasang; sumber Pro357 di PR ini belum mengubah notifikasi pada perangkat.

## Main Modules

### Mapping

Konteks Gold berbahasa Indonesia: bias H1, POI dan kontrol M15, konfirmasi M1, likuiditas, dua skenario manual, dan asisten kesiapan eksekusi. Tab Bukti menyajikan asal struktur dan harga; tab Arsip menampilkan riwayat setup lama.

### Scanner

Background scanner terintegrasi dengan runtime Android dan consumer Mapping. Scanner harus membaca contract Mapping yang sama, bukan membuat engine arah yang bersaing.

### Market Intel

Terdiri dari:

- **News** — market news dengan app-facing sanitization dan translation flow.
- **Heatmap** — liquidity heatmap dari candle market.
- **Liquidity** — tracking level BSL/SSL aktif yang belum tersapu.

Setiap panel dirancang independen sehingga kegagalan satu panel tidak seharusnya menjatuhkan panel lain.

### Candle Replay & Trading Practice

Menyediakan historical candle replay dan chart practice dengan:

- timestamp-owned replay cursor,
- multi-timeframe chart,
- pan/zoom dan mobile drawing interaction,
- drawing berbasis TIME + PRICE,
- manual BUY / SELL / WAIT decision records,
- persistence history lokal,
- SL/TP outcome evidence,
- deterministic handling untuk ambiguous same-candle outcome,
- proteksi future-candle leakage.

### Amy Trading Academy

Materi belajar trading, progress/resume, quiz, dan Trading Practice berada di module Academy. Admin Academy tersedia tetapi authentication gate masih termasuk pekerjaan lanjutan.

### Journal

Journal trading menyimpan data pengguna secara lokal dan menjadi bagian dari workspace untuk review aktivitas trading.

## Market Data Flow

| Data | Jalur utama |
|---|---|
| Live price / scanner | Native Android market connection |
| Mapping historical candles | Closed-candle data path / Supabase integration |
| News | Vercel serverless + app translation/sanitization |
| Heatmap | Vercel serverless market endpoint |
| Liquidity | Vercel serverless market endpoint |

Secrets seperti API key, token, password, dan credential **tidak boleh disimpan di source repository**.

## Release Model

Source version dan published update adalah dua state yang berbeda.

1. Source di `main` dapat dibump ke candidate berikutnya.
2. Signed Android workflow melakukan validation/build/signing.
3. APK harus lolos identity/signer/release checks.
4. `update.json` baru diaktifkan setelah release berhasil dipublikasikan.

Karena itu README tidak boleh menganggap candidate source sudah menjadi active published build sebelum pipeline selesai.

## Current Release Notes

### Pro357 candidate (PR #5)

- Bangun konteks H1/M15/M1, skenario utama/alternatif, dan batas invalidasi untuk scalping Gold.
- Siapkan notifikasi perubahan konteks hanya untuk APK Pro357+; jangan mengirim setup baru setelah fungsi server disetujui dan dipasang.
- Sumber `2.0.0-pro.357` / `950357` menunggu deployment fungsi dan APK bertanda tangan; manifest tetap Pro355.

### Pro356 source

- Memperbaiki popup color picker pada palette utama agar tidak menutup otomatis.
- Menambahkan tampilan kode HEX real-time dan isolasi struktur color picker.
- Menyederhanakan Profil dengan menghapus Global AI Settings, Status Koneksi, dan Scanner Mapping dari tampilan profil.
- Source identity dibump ke `2.0.0-pro.356` / `950356`.

### Active Pro355

- Natural UI Overhaul.
- Bottom navigation full-width dan lebih sederhana.
- Card memakai solid surface dengan glass effect yang lebih terbatas.
- Background, radius, tipografi, dan palette dibuat lebih natural dan profesional.

## Development Rules

Kontributor/agent wajib membaca `AGENTS.md` dan `.agent-memory/` sebelum melakukan perubahan.

Prinsip utama:

- buat perubahan sekecil dan seaman mungkin,
- jangan refactor logic yang sudah bekerja tanpa kebutuhan eksplisit,
- jangan mengubah canonical trading logic hanya untuk memperbaiki UI,
- jangan menyimpan secret,
- jangan menambah dependency tanpa kebutuhan yang jelas,
- pertahankan kompatibilitas Vercel serverless dan Android WebView,
- update project memory bila perubahan menghasilkan decision, bug fix, feature, atau pending work baru.

## Pending Verification

Beberapa hal tetap memerlukan observasi perangkat Android nyata, terutama rendering WebView, gesture/chart behavior tertentu, storage persistence, dan receipt native update notification. CI/static regression tidak dianggap sebagai pengganti verifikasi perangkat untuk hal-hal tersebut.

---

**Amy FX Pro** — deterministic market context, closed-candle evidence, replay, market intelligence, dan trading workspace dalam satu aplikasi.
