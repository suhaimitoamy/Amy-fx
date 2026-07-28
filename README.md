# Amy FX Preview — Personal Build

Amy FX adalah aplikasi Android hybrid untuk pemetaan dan pemantauan market **XAU/USD**. Antarmuka utama berjalan melalui WebView lokal, sedangkan layanan native seperti notifikasi, background scanner, penyimpanan, download, Firebase Messaging, dan pembaruan aplikasi ditangani oleh Kotlin.

## Fungsi Branch

Repository ini memiliki dua branch permanen dengan tujuan yang berbeda:

| Branch | Fungsi |
|---|---|
| **`personal/amyfx-private`** | Sumber pengembangan dan build **Amy FX Preview** untuk penggunaan pribadi. |
| **`main`** | Sumber aplikasi **Amy FX** untuk penggunaan publik. |

### Fokus Pengembangan Saat Ini

Pengembangan aktif saat ini berfokus pada branch:

```text
personal/amyfx-private
```

Branch personal menjadi tempat utama untuk audit, perbaikan bug, pengembangan fitur, pengujian, build APK Preview, dan pembaruan aplikasi pribadi.

Perubahan pada branch personal **tidak boleh otomatis digabungkan, disalin, atau dipindahkan ke `main`**. Branch `main` hanya boleh diubah ketika ada keputusan khusus untuk memperbarui aplikasi publik.

## Identitas Amy FX Preview

- **Branch:** `personal/amyfx-private`
- **Nama aplikasi:** `Amy FX Preview`
- **Application ID:** `com.amyelitesuite.learningpreview`
- **URI scheme:** `amyfxpreview`
- **Versi aktif:** `2.0.0-preview.173`
- **Version code:** `940173`
- **Minimum Android:** Android 8.0 / API 26
- **Target SDK:** Android SDK 35
- **Update manifest:** `personal/amyfx-private/preview-update.json`

[Download Amy FX Preview](https://github.com/suhaimitoamy/Amy-fx/releases/download/amyfx-blueprint-preview-2.0.0-preview.173/AmyFX-Preview-latest.apk)

## Alur Build Preview

Workflow Preview berada di:

```text
.github/workflows/amyfx-blueprint-preview-release.yml
```

Workflow tersebut hanya berjalan untuk branch `personal/amyfx-private` dan melakukan:

1. validasi identitas branch personal;
2. stabilisasi source Preview;
3. regression test JavaScript;
4. Android unit test dan lint;
5. build APK release bertanda tangan;
6. verifikasi package, label, versi, dan sertifikat signer;
7. publikasi release Amy FX Preview;
8. pembaruan `preview-update.json` pada branch personal.

Proses build Preview tidak menggunakan dan tidak mengubah branch `main`.

## Struktur Utama

```text
app/src/main/assets/                    WebView assets
app/src/main/assets/apps/mapping        Mapping dan Market Intelligence
app/src/main/assets/apps/market-intel   News, heatmap, dan liquidity
app/src/main/assets/apps/journal        Jurnal Trading
app/src/main/assets/apps/academy        Materi belajar
app/src/main/java/                      Android native Kotlin
api/                                    Vercel serverless functions
lib/                                    Shared backend logic
tests/                                  JavaScript regression tests
.github/workflows/                      CI dan build APK
```

## Aturan Pengembangan

- Fokus pekerjaan berada di `personal/amyfx-private`.
- Jangan menyentuh atau merge ke `main` tanpa instruksi khusus.
- Kondisi aplikasi harus dinilai dari kode dan file yang benar-benar dimuat pada branch personal.
- Build, release, dan update Amy FX Preview harus tetap memakai identitas package, URI scheme, data aplikasi, dan signing certificate Preview.
- Amy FX Preview ditujukan untuk penggunaan pribadi, sedangkan Amy FX pada `main` ditujukan untuk penggunaan publik.

## Disclaimer

Amy FX Preview bukan robot trading, Expert Advisor, atau penasihat keuangan. Aplikasi tidak membuka atau menutup order secara otomatis dan tidak menjamin hasil tertentu. Seluruh informasi yang ditampilkan merupakan alat bantu analisis; keputusan dan risiko tetap berada pada pengguna.
