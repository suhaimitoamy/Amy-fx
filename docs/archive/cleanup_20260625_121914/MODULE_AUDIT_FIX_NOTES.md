# Amy FX Module Audit Fix

Perubahan patch ini:

1. Indikator: kode Pine tidak lagi dirender via innerHTML; sekarang aman pakai textContent.
2. Indikator: nama/deskripsi indikator di-escape sebelum masuk template.
3. Indikator: kode tersimpan di Koleksi tidak lagi masuk langsung ke HTML.
4. Jurnal: klik kartu statistik tidak lagi memanggil DOM lama yang tidak ada.
5. Jurnal: copy kode punya fallback untuk WebView/file mode.
6. Jurnal: upload file tidak lagi ditolak hanya karena nama sama; duplikat dicek lewat hash.
7. Jurnal: tombol dan input Scan HP disambungkan ke fungsi scan storage.
8. Academy: progress Lanjut Belajar membaca halaman .article biasa, bukan hanya .article-layout .article.
9. Academy: toast tidak lagi memakai innerHTML.
10. Mapping: manifest PWA dihapus dari mode APK lokal.
11. Scanner: target BSL/SSL lama tidak dihapus jika start tanpa target baru.
12. Scanner: WakeLock dicek ulang jika sudah tidak held.
13. Scanner: alert target tidak saling tertahan global cooldown.
14. Scanner: notifikasi target memakai ID unik agar tidak saling menimpa.
15. Build APK workflow ditambahkan kembali.
16. VersionCode dinaikkan ke 4 dan versionName ke 1.3.

Supabase tidak diubah. Academy tetap tanpa password.
