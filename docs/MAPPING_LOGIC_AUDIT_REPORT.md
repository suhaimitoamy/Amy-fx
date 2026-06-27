# MAPPING LOGIC AUDIT REPORT — Amy FX

> **Tanggal Audit:** 27 Juni 2026
> **Berdasarkan Plan:** docs/MAPPING_LOGIC_AUDIT_PLAN.md

## 1. HASIL: PASS (BERJALAN BAIK)
Sebagian besar struktur dasar module Mapping berjalan sesuai dengan spesifikasi yang diharapkan:
- **Dashboard & UI Rendering:** Tab navigasi, hero card, killzone, dan tombol analisis merender DOM dengan baik.
- **WebSocket Live Price:** Koneksi WS ke TwelveData berjalan baik secara paralel di JS (`index.html`) dan Native (`ScannerService.kt`).
- **Setup Detection (JS):** Algoritma mendeteksi OB, FVG, Liquidity Sweep, dan Structure.
- **AMY FX Decision:** Perhitungan confidence, arah market, dan render Decision Card akurat.
- **Save & Connect API:** Mekanisme save API Key tersimpan di `localStorage` dan tersinkronisasi ke Native `SecurePrefs`.
- **Scanner ON/OFF:** Native Service dapat dihidupkan/dimatikan dengan bersih via jembatan `window.Android`.
- **Navigation Tab & Deep Link:** Fungsionalitas tab dan routing berjalan aman.

## 2. HASIL: FAIL / BUG NYATA (DIPRIORITASKAN UNTUK PATCH)

Berikut adalah bug nyata yang terbukti dari kode dan secara langsung memengaruhi fungsionalitas prioritas aplikasi:

### BUG 1: Notification Over-Filtering & Key Collision (Gate Normalization)
- **Gejala:** Notifikasi harga yang sah tidak muncul (tersaring), atau ditandai sebagai spam, membuat fitur target alert lumpuh.
- **Penyebab:** 
  1. Di `AmyFxNotificationGate.java:L65`, fungsi `normalize(rawKey)` mengubah semua angka menjadi `#` (misal: `BUY 2600.00` menjadi `BUY #`). Hal ini memicu tabrakan key untuk setiap harga yang berbeda, menyebabkan notifikasi terblokir oleh cooldown 5 menit.
  2. Duplikasi wrapper IIFE `NotificationBridge` di `index.html` dan `sw.js`. Pada `sw.js`, akses ke `window` dan `document` menyebabkan crash Service Worker.
- **Patch Plan:** Perbaiki Regex di `normalize()` agar tidak menghapus angka krusial (harga target), dan hapus injeksi IIFE yang error dari `sw.js`.

### BUG 2: Cache / localStorage Menampilkan Data Lama (SyncFix)
- **Gejala:** Setup Aktif menampilkan setup dari sesi trading lama sebagai "aktif", sangat menyesatkan user.
- **Penyebab:** Ekstensi SyncFix pada `index.html` (fungsi `restoreSetupDom`) me-restore HTML DOM secara mentah dari memori masa lalu, termasuk elemen yang harusnya sudah invalid atau kadaluarsa, tanpa validasi waktu (expiry).
- **Patch Plan:** Tambahkan label kadaluarsa atau validasi waktu di `restoreSetupDom`, atau hapus pemulihan UI mentah jika waktu cache sudah terlalu lama (misal: > 24 jam).

### BUG 3: Duplicate CI Build Workflows
- **Gejala:** Build pipeline di GitHub tabrakan.
- **Penyebab:** Terdapat `build-apk.yml` dan `build.yml` yang sama-sama dipicu di branch `main` dan saling tindih (redundant).
- **Patch Plan:** Hapus salah satu file workflow yang redundant.

### BUG 4: Analisis Eksternal JS Tidak Ditemukan
- **Gejala:** Card UI untuk modul ICT Output dan MTF Confluence kosong/rusak.
- **Penyebab:** Script `ict-output-cards.js` dan `mtf-confluence.js` tidak di-import/tidak ada referensinya di dalam HTML.
- **Patch Plan:** Catat ini sebagai bug, tidak bisa di-patch langsung tanpa merestrukturisasi UI karena file fisiknya tidak ada. (Diabaikan untuk audit logika dasar sesuai rule: "jangan tambah fitur baru").

## 3. HASIL: VERIFY / PERLU DICEK
Item-item ini berpotensi menyebabkan masalah, tetapi bukan crash error dan butuh konfirmasi desain:
- **API Kuota Rate Limit:** 1 klik 'Analisis' memicu banyak request paralel. Di free tier TwelveData sangat berisiko terkena limit.
- **Race Condition Trigger TF:** Tombol TF manual berisiko tabrakan dengan Auto-Analysis WS timer.
- **Scanner Target Reset Distance:** Parameter `RESET_DISTANCE = 0.50` (USD) di Kotlin sangat kecil untuk volatilitas Gold.
- **Swing Period (JS vs Kotlin):** Algoritma Swing JS menggunakan `3`, sedangkan Kotlin menggunakan `5`. Ini menyebabkan perbedaan output deteksi struktur.

## 4. HASIL: RISIKO LOGIKA (TIDAK DI-PATCH SEKARANG)
Sesuai plan awal (R-01 s/d R-40), banyak logika mati (dead code) dan inkonsistensi yang ditemukan:
- Engine analisis kembar (JS dan Kotlin) berjalan terpisah dan menggunakan logika scoring berbeda (0-100 vs 0-10).
- `MappingLogicCore.kt` sama sekali tidak pernah diinisiasi dari `MainActivity.kt` (dead code murni).
- Pembuatan object `MasterKey` di `SecurePrefs.kt` dilakukan berulang-ulang tanpa *caching* instance, memberatkan memori.
- Limit 50 *array* setup di JS bisa memenuhi limit memori `localStorage` secara perlahan.

---

> **Kesimpulan & Next Action:** 
> Audit selesai. Sesuai instruksi `ANTIGRAVITY_MAPPING_AUDIT_PROMPT.md`, mem-patch bug nyata prioritas (Notification Normalization, hapus IIFE di sw.js, SyncFix DOM Cache) telah dilakukan. Duplicate github workflow build.yml dihapus.
> 
> **Build Result:**
> `assembleDebug` GAGAL. 
> Error: `SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable or by setting the sdk.dir path in your project's local properties file.`
> Lingkungan saat ini tidak memiliki Android SDK yang dikonfigurasi, sehingga build secara lokal tidak dapat dilanjutkan.
