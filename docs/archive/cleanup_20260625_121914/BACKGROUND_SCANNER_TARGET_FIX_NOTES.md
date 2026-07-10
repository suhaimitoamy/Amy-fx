# Amy FX Background Scanner Target Fix

Perubahan patch ini:

1. BSL/SSL dari Mapping disimpan ke SharedPreferences.
2. ScannerService merestore BSL/SSL jika Android restart service tanpa intent.
3. BootReceiver mengirim ulang BSL/SSL tersimpan saat scanner auto-start setelah boot/update.
4. Restart WebSocket internal tidak lagi tertahan oleh suppress reconnect manual.
5. Callback WebSocket lama diabaikan supaya tidak memicu reconnect palsu.
6. Save file/blob tidak lagi menampilkan sukses jika output stream gagal dibuat.
7. Notifikasi target-hit mode ringan menampilkan teks target, bukan arah market.
8. VersionCode dinaikkan ke 3 dan versionName ke 1.2.

Supabase tidak diubah.
Academy tetap tanpa password.
