# Amy FX

Amy FX adalah aplikasi Android hybrid untuk analisis XAU/USD berbasis WebView lokal dan native Kotlin.

Aplikasi ini berfungsi sebagai alat bantu analisis, mapping, pemantauan level, jurnal, academy, dan library indikator. Amy FX bukan aplikasi eksekusi order otomatis dan bukan nasihat keuangan. Sistem ini tidak memakai AI; murni menggunakan logika manual (Rules Engine) dari kerangka ICT Concepts.

---

## Status Repo

Status saat ini: **stabilisasi fitur Mapping, performa Rules Engine, dan optimasi Background Scanner**.

Yang sudah tersedia & telah ditingkatkan (Terbaru):

- Android hybrid WebView + Kotlin native layer.
- Module Mapping untuk analisis XAU/USD (Rules Engine ICT murni, bukan AI).
- Dashboard Mapping & Analisis Setup.
- AMY FX Decision & Valid Break Info.
- Mapping Notes (Penjelasan status setup yang informatif & transparan).
- Logika Order Block (OB) akurat berbasis *Full Candle Wick-to-Wick*.
- Filter Fair Value Gap (FVG) tersaring (Mitigated gap diabaikan otomatis).
- Manajemen siklus hidup Setup (Lifecycle Memory: Setup harus masuk area entry sebelum menyentuh target TP).
- Setup Expired Status (Batas usia target kadaluwarsa disesuaikan menjadi 4 jam).
- Sistem caching Candle TTL lokal agar data HTF (H1, H4) tidak *stale* dan hemat kuota koneksi API.
- Manajemen memori WebSocket yang aman (koneksi WebView diputus otomatis saat scanner native berjalan mencegah duplikasi WS).
- Background Scanner ON/OFF native (Memantau Target Atas / Bawah Setup).
- Notifikasi Android adaptif saat area entry target tersentuh.
- Deep link / route notifikasi ke tab Mapping.
- Jurnal trading, Academy lokal, Library indikator Pine Script, dan SQLite candle cache.
- Secure preferences untuk API key native.
- **GitHub Actions build debug APK (Jalur Build Utama)**.

Yang belum dianggap final production:

- Release signing dengan keystore production asli.
- QA lengkap semua module di real device / beragam OS.
- Integration test dan Espresso test lengkap.
- UI/UX final semua module.
- Store listing final untuk distribusi publik.

---

## Fokus Utama Saat Ini: Mapping

Module utama berada di:

```text
app/src/main/assets/apps/mapping/index.html
```

Mapping bertugas membaca data XAU/USD, membuat mapping market, menampilkan bias, setup, level, dan mengirim target presisi ke native scanner.

Fitur penting Mapping:

- Live price XAU/USD via WebSocket Twelve Data.
- Auto-connect live price saat halaman Mapping dibuka jika API key sudah tersimpan.
- Caching cerdas dengan TTL dinamis (1 menit untuk M1 hingga 2 jam untuk D1/W1) demi efisiensi rate limit API.
- Timeframe: M1, M5, M15, M30, H1, H4, D1, W1.
- Deteksi struktur pasar (Swing High/Low, BOS/CHOCH).
- Deteksi ICT Concepts (OB Full Candle, FVG Filtered, Liquidity Sweep, Displacement).
- Status Setup berjenjang: MENUNGGU ENTRY, DALAM AREA, TP HIT, SL HIT / INVALID, EXPIRED.
- Analisis *Lifecycle*: Sistem UI cerdas yang tak akan mencetak "TP HIT" apabila harga terbukti belum pernah mendatangi area entri (*Entry Touched*).

Catatan penting: Mapping hanya memberi panduan teknikal dan level support/resisten kuantitatif. Mapping tidak membuka posisi trading.

---

## Alur Mapping

```text
User buka Mapping
└── API key dibaca dari localStorage
    └── WebSocket live price auto-connect
        └── data candle diambil dari Twelve Data (dengan pengamanan TTL Cache)
            └── analisis timeframe / rule engine berjalan
                └── AMY FX Decision + Setup Aktif dibuat
                    └── lifecycle system memantau interaksi entry area
                        └── rentang target dikirim ke Android bridge
                            └── Background Scanner memantau level (Target Atas/Bawah)
                                └── notifikasi dipantik saat harga tersentuh
```

---

## Background Scanner

File native utama:

```text
app/src/main/java/com/amyelitesuite/ScannerService.kt
```

Scanner berjalan sebagai foreground service Android. Fitur scanner telah dikalibrasi agar saling melengkapi dengan modul WebView:

- Menyimpan status scanner ON/OFF.
- Membaca target (Target Atas / Bawah) dari setup di Mapping.
- Membuka WebSocket Twelve Data tersendiri. (Webview otomatis membunuh soket di JS untuk menghemat limit).
- Memantau limit target secara konsisten di balik layar.
- Mengirim notifikasi Android lokal ("Entry Area Atas/Bawah Tersentuh").
- Menghapus target secara otomatis dan membatalkan status apabila telah melampaui masa 4 Jam (*Expiry Limit*).

Scanner tidak menghitung ulang analisis utamanya; ia murni bertugas memantau harga terhadap area (*range*) target yang disuntikkan dari Javascript.

---

## Notification Flow

Fungsi notifikasi:

- Menampilkan alert setup / valid break dari WebView.
- Menampilkan peringatan target entry area dari ScannerService.
- Membatasi spam notifikasi secara aktif menggunakan *cooldown gate*.
- *Deep linking*: Tap pada panel notifikasi target akan menerbangkan pengguna otomatis masuk ke tab *Analyze* atau *Dashboard* di WebView.

---

## Native Android Layer & WebView Assets

**Folder Native:** `app/src/main/java/com/amyelitesuite/`
Menampung Activity Android, Host WebView, JS bridge (`Android.*`), layanan Scanner, kontrol Notifikasi, mekanisme Supabase & SQLite.

**Folder JS Assets:** `app/src/main/assets/apps/`
Memuat logic tampilan & engine HTML/CSS/JS. Modul sentral saat ini ada di folder `mapping/`.
Kode inti *Rules Engine* berada di `mapping/js/engine/ict-core.js` (Logika ICT Matematis - Non-AI).

Catatan: Layanan Supabase, SQLite Native, dan Native Bridge sebisa mungkin dipertahankan bentuknya, dilarang di-refactor ekstrem demi menjaga stabilitas jembatan komunikasi UI ke Sistem HP.

---

## Struktur Repo

```text
Amy-fx/
├── app/
│   ├── build.gradle.kts
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── assets/
│       │   │   ├── index.html
│       │   │   └── apps/mapping/ ... dsb
│       │   └── java/com/amyelitesuite/
├── .github/workflows/
└── README.md
```

---

## Build APK (Wajib via GitHub Actions)

Mengingat proyek hibrida ini melibatkan pengikatan aset statik HTML/JS besar-besaran, mekanisme *build APK* **utamanya dijalankan melalui pipeline GitHub Actions**.
Sangat dihindari melakukan *local build* menggunakan Termux (Gradlew lokal) bagi pengembang dengan peranti HP atau keterbatasan spesifikasi, demi mencegah crash/freeze memori pada perangkat saat pengkompilasian.

Workflow utama yang menangani ini ada di:

```text
.github/workflows/build-apk.yml
```

Setelah kode selesai di-*patch* dan di-*push* ke GitHub `main` branch, navigasikan peramban ke tab "Actions" di repository. Workflow akan segera memuntahkan *artifact* `Amy-FX-APK` untuk langsung dites di Android Anda.

---

## Aturan QA & Maintenance Kode

Saat memelihara atau men-debug repositori ini, jaga pedoman ketat berikut:
- **Zero-AI Claims**: Aplikasi murni analisis struktural statis. Segala *copywriting* berbau "AI Mapping" diganti menjadi "Mapping Notes".
- **Efisiensi Limit API**: Hindari segala bentuk pemanggilan REST (TwelveData) terus-menerus. Selalu fungsikan proteksi *TTL Cache* (`isCandleStale`) di market-data.js dan integrasi koneksi tunggal WebSockets (`stopLivePrice`).
- **Ketepatan Setup**: Fitur sentuhan area (*lifecycle cache*) & ukuran Order Block (`Wick-to-Wick`) dijaga utuh untuk menghindari "False Miss" dan "False TP" yang merugikan pembacaan di real-market.

---

## Repo Hygiene

File ekstensi di bawah ini akan diabaikan oleh Git dan sebaiknya tidak dimasukkan ke dalam basis kode utama:

```text
/apply-*.sh
/*.patch
/patch_apk.py
/fix-note.txt
/*_FIX_NOTES.md
/.amyfx_backup*
```

---

## Catatan Distribusi

Dilarang mendistribusikan APK ini sebagai perangkat lunak skala publik / Production Play Store sebelum:
- Release signing aktif dengan menggunakan keystore asli (.jks).
- Pengujian Quality Assurance Manual terpenuhi menyeluruh.
- Build release APK berhasil keluar dari server Github Actions (*Signed APK*).
