# Amy FX Build Compile Fix

Perbaikan utama:

- Menghapus duplikasi `private fun isManageAllFilesGranted()` di `MainActivity.kt`.
- Menjaga scanner hanya diblokir oleh izin notifikasi, bukan battery optimization / manage all files.
- Menyamakan channel notifikasi manual ke `amy_heads_up_v5`.
- Menyamakan channel scanner ke `scanner_alerts_channel_v2`.
- Menaikkan versi APK ke `versionCode 8` dan `versionName 1.7`.

Penyebab build gagal sebelumnya:

- Kotlin compile error karena function `isManageAllFilesGranted()` muncul dua kali dalam class yang sama.

Cara pakai:

```bash
cd /storage/emulated/0/Download/Amy-fx
unzip -o ../Amy-fx-build-compile-fix.zip
bash apply-build-compile-fix.sh

git add .
git commit -m "fix build compile error"
git push origin main
```
