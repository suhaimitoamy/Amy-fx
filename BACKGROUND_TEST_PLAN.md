# Amy FX Background Test Plan

Tujuan: memastikan scanner tetap hidup saat aplikasi diminimize, layar mati, jaringan berubah, dan HP restart.

## Test 1 — Minimize 30 menit
1. Buka Amy FX.
2. Aktifkan scanner.
3. Pastikan notifikasi tetap `Amy FX Scanner Active` muncul.
4. Minimize aplikasi selama 30 menit.
5. Jangan force stop.
6. Hasil aman jika notifikasi scanner tetap ada dan event market masih bisa muncul.

## Test 2 — Layar mati 30 menit
1. Scanner ON.
2. Matikan layar HP.
3. Biarkan 30 menit.
4. Hasil aman jika notifikasi foreground tetap ada setelah layar dibuka.

## Test 3 — Ganti jaringan
1. Scanner ON.
2. Pindah dari WiFi ke data seluler atau sebaliknya.
3. Tunggu 2–5 menit.
4. Hasil aman jika watchdog/reconnect menjaga scanner tetap hidup.

## Test 4 — Restart HP
1. Scanner ON dan API key sudah tersimpan.
2. Restart HP.
3. Setelah HP hidup, cek apakah `Amy FX Scanner Active` muncul lagi.
4. Hasil aman jika BootReceiver menyalakan ulang scanner.

## Test 5 — WebSocket silent
1. Scanner ON.
2. Tunggu minimal 2 menit jika tidak ada tick.
3. Hasil aman jika watchdog melakukan reconnect otomatis.

## Catatan
- Jangan gunakan Force Stop.
- Battery Optimization harus Unrestricted / Jangan dibatasi.
- Auto Start Infinix harus aktif.
- Notification permission harus aktif.
