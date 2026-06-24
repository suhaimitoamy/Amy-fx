# Local Module Fix

Perbaikan kecil untuk module lokal di WebView:

- Mengaktifkan `allowFileAccessFromFileURLs`.
- Mengaktifkan `allowUniversalAccessFromFileURLs`.
- Mengaktifkan `allowContentAccess`.
- Mengizinkan mixed content.
- Service worker Mapping hanya aktif saat dibuka lewat HTTP, bukan `file:///android_asset`.

Tujuan:
- Indikator lokal bisa membaca `apps/indikator/manifest.json`.
- Mapping lokal bisa memuat JS/CSS dari `apps/mapping/assets/`.
