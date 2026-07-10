# Amy FX

Amy FX adalah aplikasi Android hybrid untuk analisis XAU/USD berbasis WebView lokal dan native Kotlin.

Aplikasi ini berfungsi sebagai alat bantu pemetaan (Mapping) market, pemantauan level, jurnal, academy, library indikator, dan **Market Intel** (News + Heatmap).

**DISCLAIMER PENTING:**
- Amy FX **bukan** AI trading.
- Amy FX **bukan** robot trading (EA).
- Amy FX **bukan** aplikasi auto-entry atau eksekusi order otomatis.
- Amy FX **bukan** penasihat keuangan (financial advice).
- Keputusan trading tetap dan selalu berada di tangan pengguna.

---

## Status Repo

Status saat ini: **ICT Professional Mapping System + Market Intel (News & Heatmap)**.

Mapping Amy FX bukan menggunakan Artificial Intelligence (AI) yang menebak market secara gaib, melainkan murni **Rules Engine manual yang dibangun ketat berbasis konsep ICT (Inner Circle Trader)**. 

Kami baru saja menyelesaikan upgrade besar-besaran (Phase 1–11) untuk menyempurnakan Rules Engine ini. Update terbaru menambahkan modul **Market Intel** untuk pemantauan berita dan zona likuiditas.

---

## Market Intel (🆕 News + 🔥 Heatmap)

Modul pemantauan market real-time, diakses dari **Proyek → Market Intel**:

| Panel | Sumber | Keterangan |
|-------|--------|------------|
| 📰 **News** | [SM_News_24h](https://t.me/SM_News_24h) Telegram | Scrape web view publik, 40+ keyword filter XAU/Gold, cache 5 menit |
| 🔥 **Heatmap** | TwelveData API | Swing clustering $2 bucket, visualisasi zona likuiditas M15, cache 30 detik |

### Arsitektur

```
api/news.js          → Vercel Serverless (scrape Telegram, filter keyword)
api/heatmap.js       → Vercel Serverless (TwelveData + swing clustering)
apps/market-intel/   → UI WebView (HTML + JS + CSS, dark gold theme, auto-refresh 60s)
```

Backend deploy otomatis via Vercel setiap push ke `main`.
API key **tidak disimpan di kode** — semua lewat environment variable Vercel.

### Environment Variable (Vercel)

| Key | Keterangan |
|-----|-----------|
| `TWELVEDATA_API_KEY` | API key TwelveData untuk heatmap |

---

## Fitur Mapping (Phase 1–11)

Sistem Mapping Amy FX kini dilengkapi dengan deteksi kontekstual ICT tingkat lanjut:

- **Valid Break Logic:** BOS/CHOCH hanya dianggap valid jika terjadi *body close* yang disertai *displacement* candle dominan.
- **Sweep Only Detection:** Harga yang hanya menyapu level struktur dengan *wick* (sumbu) tidak lagi dianggap sebagai BOS/CHOCH, melainkan *Liquidity Sweep*.
- **HTF Narrative / Daily Bias:** Mapping membaca bias arah struktur dari timeframe besar (H4, D1, W1) sebelum menentukan peluang Setup di timeframe kecil.
- **FVG & OB Quality:** Deteksi FVG dan Order Block yang tidak hanya mencari *gap*, tetapi juga menilai statusnya: *fresh, tested, mitigated,* atau *broken*.
- **Entry Model:** Membedakan urutan setup ICT profesional, contohnya model utama *Sweep → MSS/CHOCH → FVG*.
- **Checklist Score Transparan:** Setup dinilai dengan poin dari 0 hingga 100 berdasarkan konfirmasi *checklist*, bukan tebakan. User bisa melihat alasan penambahan nilai secara transparan.
- **Session / Killzone Context:** Mempertimbangkan waktu sesi market aktif (Asian, London, New York Killzone) sehingga setup di jam "mati" tidak diberikan prioritas tinggi.
- **Liquidity Hierarchy:** Deteksi likuiditas secara spesifik, memisahkan likuiditas *internal, external, equal high/low, swept liquidity,* dan menentukan *active Draw Target*.
- **Dealing Range + Premium / Discount Refinement:** Mengukur equilibrium dari *dealing range* struktural secara presisi agar Setup tidak terjadi di zona yang salah (contohnya nge-Buy di zona *Premium*).
- **Setup Conflict Filter:** Mesin ini dengan sadar akan menolak atau menurunkan prioritas sebuah Setup jika terdapat pertentangan logika (contoh: Entry Model BUY, tetapi HTF Narrative sangat Bearish dan harga berada di zona Premium).
- **Safety Fallback:** UI aman dan tidak akan *blank screen* apabila terjadi anomali (data candle kurang, koneksi buruk, API limit). Aplikasi akan beralih ke mode WAIT secara elegan.
- **Scanner Guard:** Proteksi anti-crash yang memastikan angka tak lazim (*NaN/null/0*) tidak pernah ditransfer dari *rules engine* JS ke Android Native Scanner.

---

## Bagaimana Mapping Bekerja?

Mapping Amy FX **tidak** sekadar mendeteksi *pattern* atau level dan langsung memberikan sinyal. Mapping ini menyusun rentetan **Konteks** selayaknya analis manusia:

1. **HTF Narrative** (Ke mana arah market besar?)
2. **Liquidity** (Di mana uang / target likuiditas berada?)
3. **Dealing Range** (Apakah harga saat ini diskon atau mahal?)
4. **Valid Break** (Apakah struktur harganya patah secara sah?)
5. **FVG/OB Quality** (Apakah ada area pijakan institusi yang masih fresh?)
6. **Entry Model** (Apakah kronologi pembentukannya rapi?)
7. **Checklist Score** (Berapa bobot konfirmasinya?)
8. **Conflict Filter** (Apakah ada rambu peringatan atau kontradiksi logika?)

Jika semua filter ini lolos, barulah sebuah **Setup Aktif** disajikan kepada pengguna.

---

## Background Scanner

File native utama untuk pemantauan latar belakang:
`app/src/main/java/com/amyelitesuite/ScannerService.kt`

**Perhatian**: Background Scanner Amy FX berjalan sebagai Android Foreground Service.
- Scanner **hanya memantau target batas atas dan bawah** dari Setup yang **sudah divalidasi** oleh mesin Mapping.
- Scanner **tidak menghitung ulang** analisis ICT di belakang layar.
- Scanner **tidak** membuka posisi trading / auto-entry.
- Scanner murni bertugas membunyikan **Notifikasi Android** apabila area *Entry* tersentuh oleh pergerakan harga riil.

---

## QA / Status Pengembangan

| Phase | Status |
|-------|--------|
| Phase 1: Valid Break | ✅ |
| Phase 2: HTF Narrative | ✅ |
| Phase 3: FVG & OB Quality | ✅ |
| Phase 4: Entry Model | ✅ |
| Phase 5: Checklist Score | ✅ |
| Phase 6: Session / Killzone Logic | ✅ |
| Phase 7: Liquidity Hierarchy | ✅ |
| Phase 8: Dealing Range + Premium/Discount | ✅ |
| Phase 9: Setup Conflict Filter | ✅ |
| Phase 10: Final Stabilization + QA | ✅ |
| Phase 11: Real Market Validation | ✅ |
| **Market Intel (News + Heatmap)** | ✅ |

---

## Build APK (Wajib via GitHub Actions)

Sangat disarankan **TIDAK** melakukan *local build* menggunakan Gradle di peranti HP (seperti Termux) demi mencegah memori crash saat kompilasi aset Web dan Native.

Build APK otomatis dilakukan melalui **GitHub Actions**:

- **Debug APK**: `.github/workflows/build-apk.yml` — setiap push ke `main`.
- **Release APK**: `.github/workflows/build-release.yml` — setiap release tag baru.

Untuk menginstal aplikasi, cukup buka tab **Actions** di repository GitHub ini, klik proses build terbaru yang berstatus sukses (hijau), dan unduh *Artifact*-nya.
