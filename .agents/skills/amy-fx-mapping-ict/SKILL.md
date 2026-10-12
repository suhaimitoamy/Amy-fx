---
name: amy-fx-mapping-ict
description: Arsitektur inti Peta Konteks Gold Amy FX Pro, aturan ICT Concepts [amygmgo] murni, Dealing Range, Confluence Scoring 8 lapis, kebijakan notifikasi sniper server diam, dan audit integritas Pro374. Mempertahankan kesinambungan konteks antar-sesi dan SOP auto-update sesi.
---

# Amy FX Pro — Gold Mapping & Market Context Architecture (ICT Pure Engine)

Gunakan skill ini sebagai **fondasi utama** setiap kali menganalisis, memodifikasi, mengaudit, atau memperbarui modul **Gold Mapping / Market Context Cockpit** pada Amy FX Pro.

---

## Tambahan aktif Pro382 — instruksi user setelah audit enam driver

User meminta memperbaiki seluruh driver, menghubungkan evaluasi/lifecycle dan bump versi. Enam kartu kini detector server nyata; skor driver bukan gate tambahan. Dashboard AMY M15/M5 dan push A+ tetap terpisah. Aturan limit/next-open, risiko, sesi, outcome ambigu dan statistik bruto ada di `docs/mapping/SIX_DRIVERS_PRO382.md`. Keputusan Pro374 kartu referensi superseded untuk engine baru saja; arsip lama tidak diaktifkan kembali.

## Aturan aktif Pro375 — keputusan user 2026-09-30

Instruksi user terbaru menyetujui integrasi seluruh skrip AMY ICT sampai visual lengkap.
Bagian formula Pro373/374 di bawah adalah **riwayat**, bukan aturan aktif Pro375.
Audit membuktikan Pro373/374 baru adaptasi sebagian; catatan lama “porting penuh”
tidak menyatakan parity yang sudah terverifikasi.

- Dashboard Bias V2 **M15** menjadi otoritas bias/locked invalidation/range/sweep/DOL/POI.
- Closed **M5** menjadi trigger; H1 adalah konteks tambahan, bukan veto arah.
- Scoring BUY/SELL terpisah mengikuti bobot skrip (mentah hingga 110, dibatasi 100),
  penalti near invalid × 0.7, konteks Asia. Angka adalah poin, bukan peluang menang.
- Formula minimum ketebalan Pro374 dan H1 invalidation guard historis tidak menjadi
  filter rumus Dashboard V2 yang sudah disetujui user. News lock, verified calendar,
  target terarah, geometri invalidasi dan readiness A+ tetap berlaku di lapisan aplikasi.
- Satu engine portable `amy-ict.mjs`/`amy-ict.js`; chart membaca candle snapshot server
  yang sama. ICT dasar diberi label referensi karena rumusnya berbeda dari Dashboard.
- Sesuai candle tertutup: tidak ada self-retest formation bar, tidak ada level session
  buatan saat data hilang, target DOL reached tidak kembali aktif setelah diambil.
- Seluruh fitur visual ICT/AMY tersedia melalui 46 kontrol tampilan; kontrol tidak
  mengubah keputusan server. Formula/batasan tercatat di `docs/mapping/AMY_ICT_PRO375.md`.
- Patuhi user terbaru jika berbeda dari catatan historis. Jangan mengklaim broker parity,
  hasil profit, notifikasi Android diterima, atau visual yang belum diamati.

---

## 1. Konteks Sesi & Kronologi Perubahan Penting

### A. Latar Belakang Masalah (Audit Awal Sesi Pro 372)
1. **Sinyal Palsu & Scalp Trap Kontra-Tren:** Sistem lama memicu notifikasi `"⚡ Scalp Kilat"` saat M15 berlawanan arah dengan H1 (fase pullback korektif). Hal ini menjebak trader mengambil posisi sell di pasar bullish atau sebaliknya.
2. **POI Terlalu Tipis (0.1–0.3 pips):** FVG dan Order Block dideteksi tanpa filter ketebalan, sehingga celah mikro (contoh: 80.4 ke 80.7) dianggap sebagai zona valid, menghasilkan noise ekstrem.
3. **Ketiadaan Filter Lokasi Dealing Range:** Posisi buy sering direkomendasikan saat harga sudah berada di pucuk Premium, dan sell di dasar Diskon.
4. **Verifikasi Ground Truth Data:** Dikonfirmasi bahwa WebSocket dan feed data Twelve Data live real-time di Supabase identik dengan MT5 (sama-sama di harga 4194) dan tidak mengalami delay 15 menit.

### B. Adopsi Logika TradingView `ICT Concepts [amygmgo]` (Rilis Pro 373)
- Menyelaraskan seluruh kalkulasi zona dan struktur dengan skrip TradingView Pine Script preferensi user:
  - Displacement body candle (`perc_Body = 0.36`, `body > meanBody(5)`).
  - Filter celah minimum: Celah FVG mikro $< 0.8–1.0$ point ($8–$10 pips emas) **wajib ditolak**.
  - Garis tengah 50% Consequent Encroachment (CE) pada setiap zona FVG dan Order Block.
  - Dealing Range (EQ 50%, Diskon $< 48\%$, Premium $> 52\%$).
  - Skor Konfluensi Multi-Layer 8 Lapis (0–100) dengan *Invalidation Guard*.
  - Visualisasi garis putus-putus (*dashed line*) warna emas untuk 50% CE di chart tanpa merusak kanvas harga.

### C. Audit Integritas & Pengetatan Pro 374
- **Otoritas Offline/Cache:** Status `READY TO REVIEW` langsung dicabut dan direset ke `BELUM SIAP` jika offline atau server heartbeat kedaluwarsa.
- **Kejujuran 6 Driver Turnamen:** Kartu driver ditampilkan sebagai model referensi riset (`BELUM DIEVALUASI`, `WR live: belum tersedia`) tanpa rekayasa Win Rate.
- **Kualifikasi Ketat Peluru Utama A+ (`aPlusEligible`):** Wajib memenuhi seluruh syarat (ready, skor $\ge 75$, lokasi sehat, target likuiditas terarah aktif, berita terverifikasi aman).
- **Kontiguitas Candle:** Mencegah loncatan candle yang hilang memalsukan FVG atau konfirmasi.
- **Prioritas News Lock:** Status pasar langsung beralih ke `NEWS LOCK · TUNDA EKSEKUSI` saat ada rilis berita USD berdampak tinggi.

---

## 2. Aturan Teknis & Formula Baku

### A. Filter Ketebalan POI & 50% CE
- **Formula:**
  ```javascript
  const curAtr = atr(candles, i) || 1.0;
  const minThickness = Math.max(0.8, curAtr * 0.15);
  ```
  Celah $< 0.8$ poin ($8 pips emas) otomatis ditolak.
- **Consequent Encroachment (CE):**
  `ce = (low + high) / 2`
  Ditampilkan pada chart candlestick sebagai garis putus-putus (*dashed line*) warna emas tanpa merusak kanvas harga.

### B. Dealing Range & Location Status
- `rangeHigh`: Swing High / Protected High M15
- `rangeLow`: Swing Low / Protected Low M15
- `span = rangeHigh - rangeLow`
- `eq = (rangeHigh + rangeLow) * 0.50`
- `eqLow = rangeLow + span * 0.48`
- `eqHigh = rangeLow + span * 0.52`
- `priceZone`: Close $> eqHigh$ (+1 / Premium), Close $< eqLow$ (-1 / Discount), lainnya (0 / Equilibrium).
- `locationStatus`:
  - **BUY**: Diskon = `+1 (Healthy)`, Premium = `-1 (Bad Location / Jangan Beli di Pucuk!)`.
  - **SELL**: Premium = `+1 (Healthy)`, Diskon = `-1 (Bad Location / Jangan Jual di Dasar!)`.

### C. Skor Konfluensi 8 Lapis (0–100)
1. **Layer 1 (20 pts):** Bias M15 Aligned H1 (+20 jika searah, +8 jika H1 netral/melemah, 0 jika perlawanan).
2. **Layer 2 (20 pts):** Liquidity Sweep (+20 jika sweep terjadi di dekat POI, +12 jika sweep umum).
3. **Layer 3 (20 pts):** POI Alignment & Rejection (+15 jika harga dekat POI, +5 bonus rejection/confirmed).
4. **Layer 4 (10 pts):** Draw on Liquidity (DOL) Aktif (+10 jika ada target likuiditas aktif searah).
5. **Layer 5 (10 pts):** Dealing Range Location (+10 jika di lokasi sehat Diskon/Premium, +4 di Equilibrium, 0 di lokasi buruk).
6. **Layer 6 (15 pts):** LTF Displacement (+15 jika ada micro FVG, +10 jika status confirmed).
7. **Layer 7 (10 pts):** LTF MSS (+10 jika ada struktur break MSS searah).
8. **Layer 8 (5 pts):** Sesi Pasar (+5 jika Sesi London/New York, +2 jika di luar jam inti).
- **Invalidation Guard:** Jika `h1.health === 'INVALIDATED'`, total skor **wajib di-hard-cap ke 0** (Grade: `NO_SETUP`).

### D. Kualifikasi Ketat Peluru Utama A+ (`aPlusEligible`)
Setup hanya berhak menyandang status dan notifikasi `Peluru Utama A+` jika lolos fungsi gerbang:
```javascript
export function aPlusEligible({ready, confluence, dr, target, side, price, news}) {
  if (!ready || (confluence?.score ?? 0) < 75 || dr?.locationStatus !== 1) return false;
  if (!target || target.status !== 'ACTIVE' || target.side !== side) return false;
  if (!Number.isFinite(price) || !Number.isFinite(target.level)) return false;
  if (side === 'BUY' && target.level <= price) return false;
  if (side === 'SELL' && target.level >= price) return false;
  if (!news || news.status === 'UNVERIFIED' || news.status === 'NEWS_LOCK') return false;
  return true;
}
```

### E. Kebijakan Notifikasi Sniper Server Diam
- **Notifikasi Prematur Dihapus Total:** Sinyal konflik `"⚡ Scalp Kilat"` dan pendekatan area `"🔔 Intip Area"` telah ditiadakan dari backend dan mobile push.
- **Server Wajib Diam:** Server **wajib diam (`event = null`)** saat pasar sedang berkonsolidasi, pullback korektif, atau belum terkonfirmasi lengkap.
- **Event Hanya Terbit Saat:**
  1. `NEWS_LOCK`: `"🛡️ Tahan Dulu: Pasar Lagi Liar"`
  2. `A_PLUS_READY` (`aPlusEligible === true`): `"🟢 Peluru Utama: BUY/SELL XAUUSD"`

---

## 3. SOP Kesinambungan Antar-Sesi & Auto-Update

### A. Prosedur Pembukaan Sesi Baru
1. **Wajib Baca Skill Ini Terlebih Dahulu:** Agen AI yang memulai sesi baru WAJIB membaca file ini untuk memahami context, arsitektur, dan batasan invariant proyek.
2. **Periksa Versi & Git Status:** Cek `app/build.gradle.kts` dan jalankan `git log -n 3 --oneline` untuk memverifikasi posisi branch `main`.
3. **Patuhi Invariant:**
   - Kanvas peta harga (candlestick, zoom, pan) tidak boleh diganggu.
   - Jangan pernah menambahkan kembali notifikasi bising/prematur.
   - Selalu jalankan `npm test` untuk memastikan 139+ suite pengujian tetap lulus 100%.

### B. Prosedur Auto-Update di Akhir Sesi
Setiap kali sesi kerja selesai atau pengguna meminta penutupan/pembaharuan skill:
1. Agen secara otomatis mencatat ringkasan ke dalam tabel **Riwayat Pembaruan Sesi** di bagian bawah dokumen ini.
2. Catat nomor build versi baru, file yang diubah, dan keputusan teknis yang disepakati.

---

## 4. Riwayat Pembaruan Sesi (Changelog Skill)

| Tanggal | Versi / Build | Topik / Perubahan Kunci |
| :--- | :--- | :--- |
| **2026-09-30** | `2.0.0-pro.373` (`950373`) | Porting penuh TradingView `ICT Concepts [amygmgo]`: filter FVG $\ge 0.8$ poin, titik 50% CE garis putus-putus emas, Dealing Range (Diskon vs Premium), Confluence Scoring 8 lapis, eliminasi notifikasi Scalp Kilat. |
| **2026-09-30** | `2.0.0-pro.374` (`950374`) | Audit integritas Mapping: reset status `BELUM SIAP` saat offline/cache, kejujuran model 6 driver (`BELUM DIEVALUASI`), pengetatan fungsi `aPlusEligible` (target terarah + berita valid), kontiguitas candle FVG/konfirmasi, dan isolasi invalidasi terarah. |
| **2026-09-30** | Pembuatan Skill | Inisialisasi skill `amy-fx-mapping-ict` sebagai memori hidup berkelanjutan dan SOP auto-update sesi. |

| **2026-09-30** | `2.0.0-pro.375` (`950375`) | Integrasi engine AMY Dashboard V2 M15/M5 bersama, H1 konteks tambahan, scoring BUY/SELL dan near-invalid, seluruh visual ICT/AMY. 140 file regresi dan browser mobile lulus; deployment scalper-engine v22. Klaim port penuh Pro373/374 ditandai historis dan superseded oleh audit/integrasi Pro375. |

| **2026-09-30** | `2.0.0-pro.376` (`950376`) | Finalisasi integrasi: skor lawan bias ditandai jelas pada seluruh narasi; invalidasi/target dibandingkan close M5 terbaru. Versi baru menjaga identitas APK375 yang sudah dipublikasikan. |

| **2026-09-30** | `Pro376` verifikasi final | Actions36696811345 dan lint36696811141 lulus; manifest950376 aktif, APK/checksum dan engine bersama identik. Backend v24 menolak target utama lawan arah/reached/salah sisi harga M5. 140 file regresi,30 kasus AMY, Chromium mobile dan snapshot nyata lulus. Perbaikan serialization backend saja dicatat [skip ci] agar APK376 tidak diganti. Notifikasi di HP dan parity broker TradingView belum diamati. |

| **2026-09-30** | `2.0.0-pro.377` (`950377`) | Atas permintaan user, Mapping diringkas: status/area/CE/invalidasi/target/chart di utama, bukti dan6 model driver dalam menu Detail.46 kontrol tetap ada dalam4 grup; narasi2 baris memprioritaskan risiko. Engine/backend tidak berubah.141 file regresi dan browser mobile lulus; verifikasi rilis menunggu CI. |

| **2026-09-30** | `Pro377` verifikasi final | Signed Actions36701710390 dan lint36701710388 lulus. Manifest950377 aktif; APK32,667,949 byte, SHA2561998d6efe381114b230d393db90f0a675dc2b7b6263f10f12775941796e7ed76 cocok.141 regresi dan browser360/390 dark/light/detail/settings/offline lulus. Aset Mapping cocok dengan APK; engine/backend tetap. Notifikasi update di perangkat belum diamati. |

| **2026-09-30** | `2.0.0-pro.378` (`950378`) | Fullscreen Chart Gold via body portal: axis16px, label/narasi14px, portrait/landscape, tombol Keluar/Back/Escape. Instance, candle, zoom dan engine dipertahankan; tanpa perubahan native/backend. 141 regresi dan browser360/390/844×390, pinch/pan/Back/Escape/fallback/offline lulus; verifikasi rilis menunggu CI. |

| **2026-09-30** | `Pro378` verifikasi final | Signed Actions36704449764 dan lint36704449726 lulus; manifest950378 aktif. APK32,670,025 byte/SHA256516d95d6fd9bcfec15985dc6b8cc354e51480265d8ab0689936dce1947ce91bf cocok dengan aset source.141 regresi dan browser fullscreen/portrait/landscape/pinch/pan/Back/Escape/fallback/offline lulus. Engine/backend tetap; perangkat Android belum diamati. |

| **2026-09-30** | `2.0.0-pro.379` (`950379`) | Perbaikan sumbu harga sentuh: vertTouchDrag aktif pada Mapping; sumbu waktu mengatur lebar candle. Auto harga/double-tap reset; overlay ikut price scale dan batas sumbu terukur. Refresh mempertahankan pan/skala manual. Home/backend/engine tetap. Verifikasi rilis menunggu CI. |

| **2026-09-30** | `Pro379` verifikasi lokal | 142 file regresi dan Chromium touch sumbu harga/waktu, double-tap/Auto harga, sinkronisasi overlay, refresh-preserved viewport serta fullscreen/pinch/pan/Back/Escape/offline lulus. Referensi resmi Lightweight Charts 4.2.3 ada di docs/mapping/CHART_GESTURES_PRO379.md. Rilis bertanda tangan belum diverifikasi. |

| **2026-09-30** | `Pro379` verifikasi final | Signed Actions36707758513 dan lint36707758575 lulus; manifest950379 aktif. APK32,670,665 byte/SHA256ff37cbe0180131239ae56fa46bb9b1b07c28a62f323e79d295922b91d80136ae cocok dengan manifest/checksum dan8 aset source.142 regresi dan Chromium sumbu harga/waktu, double-tap/Auto harga, sinkronisasi overlay, viewport setelah refresh serta fullscreen/pinch/pan/Back/Escape/offline lulus. Engine/backend tetap; perangkat Android belum diamati. |

| **2026-09-30** | `2.0.0-pro.380` (`950380`) | Restrukturisasi Kurikulum Academy: format perkuliahan 3 Semester dan 36 Pertemuan (~1 Jam / SKS per Pertemuan). Konsolidasi 569 file bab menjadi 36 modul master interaktif dengan navigasi bab dan drawer TOC. Pembersihan clone/duplikat bagian-30/36. 142 regresi lulus; verifikasi rilis menunggu CI. |
| **2026-09-30** | `2.0.0-pro.381` (`950381`) | Kompas Fundamental sebagai pusat Market Intel, tab default, dan prioritas pertama. 8 Poin Kompas institusional, drilldown bukti Berita/Kalender, mitigasi 11 bug baseline, isolasi parser berita, evaluasi Actual vs Forecast, dan sequence guard translasi. 143 regresi lulus; verifikasi rilis menunggu CI. |

| **2026-09-30** | Read-only driver diagnosis, source Pro381 | Production scalper-engine v24 equals source and runs context-only; six tournament cards are references, zero setup rows for their IDs. Last setup24 September; no setup creation during72h. Pro376788 snapshots have no A+, with M5/target gates predominant.143 regressions pass. Local audit notes only; no strategy/deployment changes. |


| **2026-09-30** | Local six-driver logic audit, baseline Pro381 | User prioritizes driver logic before gates. Generic legacy Sweep/MSS/FVG had unsupported Sniper/Fib78.6%/0.8R attribution from Pro368; removed metadata only, geometry preserved. Five other detectors absent. docs/mapping/SIX_DRIVER_LOGIC_AUDIT.md records six corrected rule proposals, payoff break-even math and legacy2R integration conflict. No new detector, canonical-engine change, activation or deployment. |

Validasi koreksi identitas driver lokal: npm test, seluruh144 file regresi lulus;21 pemeriksaan model/struktur terarah lulus. Patch belum dipublikasikan.

| **2026-09-30** | `2.0.0-pro.382` (`950382`) sumber | Enam detector nyata, OTE limit, CHoCH/ATR, quorum Ensemble, risk policy Shield, sesi/early exit Rapid, BE Adaptive, persistence dan statistik bruto. Mapping menampilkan evaluasi/setup/toggle/chart; legacy arsip dipertahankan. Skor bukan gate driver. Lihat docs/mapping/SIX_DRIVERS_PRO382.md. Publikasi dan verifikasi live menyusul. |

Validasi lokal Pro382: seluruh 146 file regresi lulus; 21 kasus driver/lifecycle + 2 kasus API baru, BUY/SELL keenam model. Browser mobile 360/390, enam kartu/toggle, filter OFF, refresh detail, mode gelap, offline dan tanpa overflow/pageerror. Replay 240 M5 produksi: satu kandidat Rapid; fixture kalender sintetis, bukan backtest profit. Migration constraint applied; scalper-engine25, scalper-setups11, scalper-preferences2 deployed. Build signed dan manifest masih menunggu publikasi.


Pro382 release verification completed: source 11239e1de1b42d6677cbd074619c636507d762ab; signed Actions36792997261 and lint36792997230 succeeded. Public update.json enabled at2.0.0-pro.382/950382. Downloaded31,534,089-byte APK SHA25634f42b0f0e34995e7df9ff0a425e3e68b74ec59acfa531f08f0ea007d4b32b3f matches manifest/checksum; all11 changed assets match source.146 regression files pass. Production engine25/setup-reader11/preferences2 active; five engine files byte-identical to source and successful live run returns all6 driver evaluations. Browser360/390 light/dark, toggles, detail refresh, selected chart, offline and overflow checks pass. Replay240 M5 with synthetic calendar produced one Rapid candidate; not a profitability backtest. Earlier build/deployment-pending notes are resolved. Actual Android update receipt remains unobserved.
