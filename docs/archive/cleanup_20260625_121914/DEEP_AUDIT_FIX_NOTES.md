# Amy FX Deep Audit Fix

Patch ini memperbaiki bug hasil audit lanjutan tanpa mengubah bypass login Academy.

Perubahan:

1. Mapping tidak lagi memanggil `html2pdf` dari CDN online.
2. Mapping tidak lagi mencoba register service worker di APK lokal.
3. Tombol `← Amy FX` sekarang selalu balik ke dashboard utama via bridge Android, termasuk dari halaman nested Academy.
4. Background Scanner tidak bisa di-enable jika API key belum pernah tersimpan.
5. Scanner default menjadi mode ringan: hanya pantau BSL/SSL dari Mapping saat native market alerts OFF.
6. Foreground scanner tidak lagi menampilkan M15/HTF/Score saat mode ringan.
7. WebSocket close manual tidak lagi memicu reconnect palsu.
8. Reconnect job dibuat tidak menumpuk.
9. Alert BSL/SSL di mode ringan memakai pesan target Mapping, bukan pesan otak native.
10. Save/download blob memakai MediaStore untuk Android baru.
11. File chooser lebih aman saat hasil picker kosong/null.
12. Link internal Academy yang 404 sudah diperbaiki.
13. Nama artifact GitHub Actions diganti menjadi Amy-FX-APK.

Catatan:
- Supabase tidak diubah.
- Academy tetap tanpa password sesuai permintaan.
- Audit link internal HTML lokal: 0 missing link.
