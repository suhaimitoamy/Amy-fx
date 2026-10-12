# Antigravity Shared Permanent Memory (Akun 1 & Akun 2)
# File ini otomatis dibaca oleh Antigravity Akun 1 maupun Akun 2 di setiap sesi baru.

## 1. Identitas & Profil Lingkungan
- **User:** Trader Pro & Developer Amy FX.
- **Environment:** Termux Linux ARM64 (aarch64), port preview 8080 (`tools/serve-local.mjs`).
- **Shared Storage:**
  - Workspace utama: `/root/Amy-fx-pro`
  - Skills global: `/root/.agents/skills/`
  - Obsidian Catatan Pribadi: `/sdcard/Download/Obsidian/Catatan Pribadi`
  - PWA iPhone: `/root/download/Amy-fX-pwa`
  - Lab Backtest: `/sdcard/Download/lab backtest/`

## 2. Invariant Inti Amy FX Pro (Wajib Dipatuhi Kedua Akun)
1. **Paritas Card Chart Gold (100% Mirip Peta Harga):**
   - Card Chart Gold di Cockpit Mapping (`apps/mapping/index.html`) dan Card Peta Harga di Beranda (`index.html`) identik 100% dalam kontainer glassmorphism (`.gold-price-panel`), kontrol [M15 | M5], heading, live price kanan, dan canvas 340px.
   - Pembeda: Chart Gold memiliki layer visual indikator ICT teknikal dari skrip `AMY_ICT_NextGen.pine` (PDH/PDL, PWH/PWL, Asia High/Low, FVG/OB + 50% CE, BOS/MSS, Trend Invalidation).
2. **Golden Recovery Protocol (Dilarang Eksperimen Liar):**
   - Jika Chart Gold error visual/glitch, **AI WAJIB MENUNGGU PERINTAH LANGSUNG USER** sebelum menyamakan kembali dengan Peta Harga.
3. **Filter Pasar Libur (Weekend Anti-Spam):**
   - Sesi Gold tutup Jumat 17:00 NY s.d. Minggu 17:00 NY (`isWeekendClosure`).
   - Dilarang memunculkan/spam candle flat 15m saat weekend. Status wajib: `Pasar Tutup (Akhir Pekan) · Candle Terakhir [Jumat] WITA`.
4. **Interaksi Sumbu Harga Kanan:**
   - Chart Gold di Mapping dan Fullscreen wajib mendukung vertical drag/pinch zoom pada skala harga kanan (`vertTouchDrag: true`, `axisPressedMouseMove: { price: true }`).

## 3. Kebijakan Fast Dev Mode (Hemat Token & Waktu)
1. **Dilarang Menjalankan Full npm test (148 Suites) Otomatis:**
   - Dilarang menjalankan 148 tes secara rutin di setiap edit kecil karena membuang 45-60 detik dan ribuan token.
   - Full test HANYA dijalankan jika user mengetik perintah eksplisit: *"jalankan test"*.
2. **Standar Pengujian Cepat:**
   - Validasi sintaks kilat (0.05s): `node --check <file>`
   - Targeted test 1 file (0.2s): `node --test tests/<spesifik>.test.mjs`
   - Visual verification langsung di preview: `http://localhost:8080/`

## 4. Protokol Tim Laya AI Subagent Dispatcher
- Evaluasi otomatis tingkat kompleksitas tugas (Level 0 s.d. Level 5).
- Triage mandiri membagi pekerjaan ke 0 s.d. maksimal 5 subagent spesialis tanpa membebani user secara manual.
- Subagent dilarang mengedit file yang sama secara bersamaan (Aturan 1 File 1 Agen).

## 5. Sinkronisasi Dokumen Proyek
- Setiap keputusan teknis penting dicatat ke:
  - `/root/Amy-fx-pro/CLAUDE.md`
  - `/root/Amy-fx-pro/.agent-memory/DECISIONS.md`
  - `/root/Amy-fx-pro/.agent-memory/RULES.md`
