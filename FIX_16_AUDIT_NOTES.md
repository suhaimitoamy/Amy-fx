# Amy FX Audit Fix

Patch ini memperbaiki bug audit tanpa menyentuh Supabase default config.

Perubahan utama:

1. Menonaktifkan bootstrap workflow yang bisa menimpa repo final.
2. Mengganti root Gradle project name menjadi Amy FX.
3. Menaikkan versionCode/versionName.
4. Menghapus Google Font online dari dashboard utama.
5. Membuat permission gate tidak memblokir Jurnal/Academy/Mapping.
6. Membatasi permission storage lama dengan maxSdkVersion.
7. Menonaktifkan allowBackup.
8. Mengganti teks indikator dari GitHub/internet menjadi lokal.
9. Menambah fallback copy kode indikator.
10. Menambah tombol kecil kembali ke Amy FX saat masuk module lokal.
11. BootReceiver hanya menyalakan scanner kalau scanner memang enabled.
12. Native market alerts scanner dimatikan default agar tidak menjadi otak kedua.
13. Reconnect WebSocket dibuat bertahap 15s/30s/45s/60s.
14. Watchdog tidak lagi mengirim notifikasi market.
15. Target BSL/SSL dari Mapping tidak ditimpa native M15 saat target eksternal ada.
16. Channel notifikasi foreground scanner dan market alert dipisah.

Build test belum bisa dijalankan di environment ini karena Gradle wrapper perlu download dari services.gradle.org dan internet container tidak tersedia.
