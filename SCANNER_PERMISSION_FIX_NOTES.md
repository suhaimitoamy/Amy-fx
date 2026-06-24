# Scanner Permission Fix

Perbaikan:
- Scanner tidak lagi diblokir oleh Battery Optimization / Manage All Files.
- Scanner hanya memblokir jika izin notifikasi Android belum aktif.
- Aplikasi otomatis meminta izin notifikasi Android 13+ saat dibuka.
- Native bridge `Android.openManageAllFilesSettings()` ditambahkan.
- Channel notifikasi manual diganti ke `amy_alerts_v3` agar importance lama tidak nyangkut.
- Channel alert scanner diganti ke `scanner_alerts_channel_v2` agar heads-up lebih mungkin muncul.
- Alert notification diberi priority high, category alarm, public visibility, defaults sound/vibrate.
