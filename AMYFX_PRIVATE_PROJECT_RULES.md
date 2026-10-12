# Amy FX Private — Aturan Proyek Permanen

## Identitas jalur

- Repository: `suhaimitoamy/Amy-fx`
- Branch pribadi utama: `personal/amyfx-private`
- Branch publik: `main`
- Aplikasi pribadi tetap memakai identitas Android Amy FX Preview agar dapat memperbarui instalasi yang sudah ada.

## Tujuan

Branch `personal/amyfx-private` adalah sumber utama Amy FX untuk penggunaan pribadi pemilik. Semua upgrade pribadi, eksperimen yang sudah disetujui, perbaikan, pengujian, build APK, dan rilis update pribadi dilakukan di branch ini.

Branch `main` adalah Amy FX publik yang stabil. Branch publik tidak boleh ikut berubah hanya karena pengembangan aplikasi pribadi.

## Larangan mutlak

1. Jangan menulis, merge, rebase, force-push, atau cherry-pick ke `main` tanpa izin tertulis dan spesifik dari pemilik.
2. Jangan mengganti package produksi `com.amyelitesuite`.
3. Jangan mengubah `update.json`, workflow produksi, release produksi, signing produksi, atau artefak produksi.
4. Jangan mengubah branch pengembangan aktif secara diam-diam.
5. Jangan menghapus data pengguna, mengganti package pribadi, URI scheme pribadi, signing key pribadi, atau update channel pribadi tanpa rencana migrasi dan izin pemilik.
6. Jangan menganggap perubahan pribadi harus dipindahkan ke publik.

## Identitas aplikasi pribadi yang harus dipertahankan

- Application ID: `com.amyelitesuite.learningpreview`
- Nama aplikasi: `Amy FX Preview`
- URI scheme: `amyfxpreview`
- Update manifest: `preview-update.json` pada branch `personal/amyfx-private`
- Sertifikat signing: sertifikat Preview permanen yang sudah digunakan aplikasi terpasang
- Release tag: jalur release Preview/private

Identitas tersebut dipertahankan agar aplikasi pribadi dapat terpasang berdampingan dengan Amy FX publik, tetap membaca data lokalnya sendiri, dan menerima update tanpa uninstall.

## Prosedur kerja AI

Sebelum mengubah kode, AI wajib:

1. Memastikan branch aktif adalah `personal/amyfx-private`.
2. Memastikan `main` tidak akan berubah.
3. Membaca masalah dan mengaudit bagian terkait.
4. Menjelaskan temuan serta rencana perubahan.
5. Menunggu izin pemilik sebelum mulai menulis kode, kecuali pemilik sudah memberi izin jelas dalam percakapan yang sama.

Saat mengerjakan:

1. Batasi perubahan pada kebutuhan yang disetujui.
2. Pertahankan package, signing, update channel, dan data aplikasi pribadi.
3. Jalankan regression test yang relevan serta pemeriksaan Android sebelum publikasi update.
4. Jangan menyatakan selesai sebelum build dan jalur update terverifikasi.

## Kalimat konteks singkat untuk AI

> Kerjakan hanya Amy FX pribadi pada branch `personal/amyfx-private`. Jangan sentuh atau merge ke `main`. Pertahankan package `com.amyelitesuite.learningpreview`, signing Preview, URI `amyfxpreview`, data aplikasi, dan update channel pribadi. Audit dan jelaskan rencana terlebih dahulu, lalu tunggu izin sebelum menulis kode.
