# Amy FX

Amy FX adalah aplikasi Android hybrid untuk analisis XAU/USD berbasis WebView lokal dan native Kotlin.

Aplikasi ini berfungsi sebagai alat bantu pemetaan (Mapping) market, pemantauan level, jurnal, academy, dan library indikator.

**DISCLAIMER PENTING:**
- Amy FX **bukan** AI trading.
- Amy FX **bukan** robot trading (EA).
- Amy FX **bukan** aplikasi auto-entry atau eksekusi order otomatis.
- Amy FX **bukan** penasihat keuangan (financial advice).
- Keputusan trading tetap dan selalu berada di tangan pengguna.

---

## Status Repo

Status saat ini: **ICT Professional Mapping System (Tahap Awal)**.

Mapping Amy FX bukan menggunakan Artificial Intelligence (AI) yang menebak market secara gaib, melainkan murni **Rules Engine manual yang dibangun ketat berbasis konsep ICT (Inner Circle Trader)**. 

Kami baru saja menyelesaikan upgrade besar-besaran (Phase 1–11) untuk menyempurnakan Rules Engine ini. Fokus saat ini adalah: **Validasi Real Market dan QA Behavior**.

---

## Fitur Mapping Terbaru (Phase 1–11)

Sistem Mapping Amy FX kini dilengkapi dengan deteksi kontekstual ICT tingkat lanjut:

- **Valid Break Logic:** BOS/CHOCH hanya dianggap valid jika terjadi *body close* yang disertai *displacement* candle dominan.
- **Sweep Only Detection:** Harga yang hanya menyapu level struktur dengan *wick* (sumbu) tidak lagi dianggap sebagai BOS/CHOCH, melainkan *Liquidity Sweep*.
- **HTF Narrative / Daily Bias:** Mapping membaca bias arah struktur dari timeframe besar (H4, D1, W1) sebelum menentukan peluang Setup di timeframe kecil.
- **FVG & OB Quality:** Deteksi FVG dan Order Block yang tidak hanya mencari *gap*, tetapi juga menilai statusnya: *fresh, tested, mitigated,* atau *broken*.
- **Entry Model:** Membedakan urutan setup ICT profesional, contohnya model utama *Sweep → MSS/CHOCH → FVG*.
- **Checklist Score Transparan:** Setup dinilai dengan poin dari 0 hingga 100 berdasarkan konfirmasi *checklist*, bukan tebakan. User bisa melihat alasan penambahan nilai secara transparan.
- **Session / Killzone Context:** Mempertimbangkan waktu sesi market aktif (Asian, London, New York Killzone) sehingga setup di jam "mati" tidak diberikan prioritas tinggi.
- **Liquidity Hierarchy:** Deteksi likuiditas secara spesifik, memisahkan likuiditas *internal, external, equal high/low, swept liquidity,* dan menentukan *active Draw Target*.
- **Dealing Range + Premium / Discount Refinement:** Mengukur equilibrium dari *dealing range* struktural secara presisi agar Setup tidak terjadi di zona yang salah (misalnya nge-Buy di zona *Premium*).
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

Rangkaian Upgrade Mapping Tahap 1 telah **SELESAI**:

1. [x] Phase 1: Valid Break
2. [x] Phase 2: HTF Narrative
3. [x] Phase 3: FVG & OB Quality
4. [x] Phase 4: Entry Model (Sweep → MSS → FVG)
5. [x] Phase 5: Checklist Score
6. [x] Phase 6: Session / Killzone Logic
7. [x] Phase 7: Liquidity Hierarchy
8. [x] Phase 8: Dealing Range + Premium / Discount Refinement
9. [x] Phase 9: Setup Conflict Filter
10. [x] Phase 10: Final Stabilization + QA Mapping
11. [x] Phase 11: Real Market Validation & QA Behavior

---

## Build APK (Wajib via GitHub Actions)

Sangat disarankan **TIDAK** melakukan *local build* menggunakan Gradle di peranti HP (seperti Termux) demi mencegah memori crash saat kompilasi aset Web dan Native.

Build APK otomatis dilakukan melalui **GitHub Actions**:

- **Debug APK** otomatis diproduksi oleh workflow: `.github/workflows/build-apk.yml` setiap ada perubahan pada branch `main`.
- **Release APK** otomatis diproduksi oleh workflow: `.github/workflows/build-release.yml` apabila ada rilis baru (jika workflow tersedia).

Untuk menginstal aplikasi, cukup buka tab "Actions" di repository GitHub ini, klik proses build terbaru yang berstatus sukses (hijau), dan unduh *Artifact*-nya.
