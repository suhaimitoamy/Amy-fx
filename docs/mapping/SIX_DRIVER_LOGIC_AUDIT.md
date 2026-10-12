# Audit logika enam driver Mapping

Tanggal: 2026-09-30. Baseline main Pro381: `048bafcb01016490f030190d0a2f8e73d521a537`.
Lingkup: definisi, entry, invalidasi, target dan manajemen posisi. Audit ini tidak menguji profitabilitas atau mengaktifkan detector baru.

## Bukti implementasi

Enam definisi di `app/src/main/assets/apps/mapping/js/ict-workspace/context-panel.js` merupakan kartu referensi. Status sekarang `BELUM DIEVALUASI`. Pencarian enam ID menemukan konstanta kartu, fixture arsip dan atribusi Sniper pada `engine/core/setup-model.js`; lima driver lainnya tidak memiliki detector mandiri dalam repo ini. Strategi eksternal yang tidak berada di repo belum dapat dinilai.

`modelSweepMssFvg` menghitung sweep → MSS → FVG, entry rentang FVG, SL di luar ekstrem sweep dan target EQ/likuiditas. Ia tidak menghitung retracement 75%–78,6% atau TP 0,8R. Identitas Sniper dan parameter itu ditambahkan sebagai metadata pada commit `9bbca50`, tanpa perubahan perhitungan.

Versi `80cb533` membuat status enam driver dari konteks bersama: ready, kesehatan H1, POI, sweep dan volatilitas. `TRIGGERED (OTE 78.6%)`, `CHOCH TRIGGERED` dan `EARLY CUT WATCH (-0.35R)` tidak membuktikan bahwa Fib, 2×ATR atau exit posisi dihitung. Adaptive dan Shield memakai trigger sama: ready, H1 sehat dan tanpa konflik. Pro374 kemudian menghapus status yang menyesatkan itu.

Kesimpulan: belum ada bukti enam strategi terlalu ketat. Definisi belum lengkap dan label lama menyatakan kemampuan yang tidak dihitung. Memperbaiki definisi driver harus mendahului perubahan skor.

## Penilaian dan rumusan perbaikan

| Driver | Konsep trading | Masalah | Perbaikan definisi |
| --- | --- | --- | --- |
| Sniper, OTE 75%–78,6%, 0,8R | Retracement dalam setelah perubahan struktur masuk akal sebagai hipotesis. High win rate belum terbukti. | Fungsi generik salah diberi identitas Sniper. Anchor, fill dan arti SL ketat belum jelas. | Hitung zona Fib dari impuls terkonfirmasi untuk BUY/SELL. Tentukan limit atau trigger retest M5. SL mengikuti invalidasi struktur, bukan diperkecil demi label. Hitung TP 0,8R dari entry dan risk aktual jika payoff itu dipertahankan. |
| Adaptive Smart, 1,6R / BE 0,8R | Trend continuation dan pengelolaan posisi masuk akal. | Tidak ada algoritme adaptasi, entry, BE atau trailing. Memindahkan SL sekali ke BE berbeda dari trailing stop. | Definisikan entry M5, invalidasi dan target 1,6R; pemindahan SL setelah +0,8R memakai harga yang dapat dieksekusi. Hitung biaya pada BE. Trailing berikutnya perlu aturan tersendiri. |
| Swing CHoCH + OTE, 2×ATR / 75% / 0,8R | Reversal terkonfirmasi lalu retracement masuk akal. | Konflik konteks bukan CHoCH. Body atau range 2×ATR belum jelas. Impuls besar plus retracement dalam bisa jarang terjadi. | CHoCH harus close menembus swing yang sudah diketahui. Nyatakan body atau range dibanding ATR sebelum impuls. Bekukan anchor Fib 75%, invalidasi dan expiry. Uji 2×ATR lewat replay; jangan menurunkannya hanya untuk menambah sinyal. |
| Multi-Driver Ensemble, Fib 72,5% / ATR 2,5 / 0,8R | Penggabungan strategi bisa berguna jika komponennya independen. | Flag volatilitas bukan ensemble. Komponen, quorum, konflik arah dan satuan ATR 2,5 tidak jelas. Bukti sama dapat dihitung berulang. | Evaluasi driver dasar dahulu. Definisikan quorum kandidat searah dan resolusi konflik. Pertahankan asal entry/SL; jangan rata-ratakan geometri tanpa aturan. Nyatakan ATR 2,5 sebagai unit harga atau kelipatan ATR. Fib 72,5% memerlukan hipotesis tersendiri. |
| Conservative Shield, 0,7R | Pengendalian risiko konservatif masuk akal. | Banyak filter dan target pendek tidak membuktikan drawdown rendah. Tidak ada sizing, exposure atau batas rugi. Trigger lama sama dengan Adaptive. | Tentukan driver entry dasar serta aturan ukuran posisi, exposure, batas kerugian dan berhenti trading. Jika hanya membatasi risiko driver lain, definisikan sebagai policy risiko. Evaluasi payoff 0,7R setelah biaya. |
| Human MTF Rapid Scalper, 1,3R / cut −0,35R | Konteks MTF, sesi aktif dan trigger M5 masuk akal. | Status lama tidak mengecek sesi atau mengelola posisi. Konflik konteks bukan kerugian posisi. Frekuensi 3–5/hari tidak dapat dijamin. | Sesi London/NY menggunakan timezone dan DST. Tetapkan entry M5, SL struktural dan target. Bedakan hard stop −0,35R dari early exit ketika struktur gagal. Hard stop baru mengubah risk efektif; early exit tidak menjamin rugi maksimal −0,35R saat gap/slippage. |

Ini adalah rumusan koreksi untuk ditinjau, bukan implementasi enam detector atau klaim profitable. Pilihan eksekusi yang tidak ditemukan di source tidak boleh dianggap sebagai strategi asli backtest.

## Geometri dan urutan

Untuk impuls dari low L ke high H, BUY retracement r: `H − r × (H − L)`. Untuk impuls turun H ke L, SELL: `L + r × (H − L)`. Dengan Δ = H−L, zona BUY 75%–78,6% adalah `[H−0,786Δ, H−0,75Δ]`; SELL `[L+0,75Δ, L+0,786Δ]`.

Anchor harus diketahui saat keputusan dibuat. Candle pembentuk zona tidak sekaligus dihitung sebagai retest setelah pembentukan. Sweep, break dan retest dapat terjadi berurutan pada candle berbeda; tidak perlu semua menjadi syarat candle terbaru. Setiap kandidat membutuhkan expiry dan pembatalan ketika invalidasi ditembus.

Bedakan harga limit, trigger dan fill. Tetapkan spread/komisi/slippage dan urutan TP/SL/BE. Jika satu bar menyentuh TP dan SL tanpa data intrabar, tandai hasil ambigu atau gunakan kebijakan konservatif yang eksplisit. Jangan mengklaim win dari urutan yang tidak diketahui.

## RR dan pengukuran

Dengan win +bR, loss −1R dan tanpa biaya, win rate impas = `1/(1+b)`. Ini bukan prediksi win rate:

| Payoff | Win rate impas sebelum biaya |
| --- | --- |
| 0,7R | 58,82% |
| 0,8R | 55,56% |
| 1,3R | 43,48% |
| 1,6R | 38,46% |

Biaya menaikkan ambang. BE, partial exit, trailing dan early cut membutuhkan pengukuran hasil bersih dalam R dan drawdown. Statistik TP/SL saja bukan ukuran profitabilitas lengkap.

`getTournamentDrivers` menggunakan skor arsip `wins×10−losses×15`. Skor itu tidak memperhitungkan RR berbeda; bukan P&L atau expectancy, dan tidak boleh dipakai sebagai gate entry atau peringkat ekonomi strategi.

## Konflik integrasi yang ditunda

Jalur legacy `core/setups.js` menetapkan target utama minimal 2R dan manajemen M15: 90% di 1R, runner 10% minimal 2R. Payoff fixed 0,7/0,8/1,3/1,6R tidak cocok jika langsung melewati jalur itu. Jalur legacy berbeda dari engine canonical AMY M15/M5 yang aktif. Temuan ini tidak membuktikan gate legacy menyebabkan production tanpa setup.

Sebelum integrasi, setiap driver harus membawa trade plan serta manajemen posisinya sendiri. Skor/grade engine saat ini bukan win rate driver. Gate global baru dibahas setelah definisi dan replay driver tersedia.

## Koreksi lokal

Atribusi Sniper, Fib 78,6%, target 0,8R dan label Deep OTE dihapus dari model generik. Nama kembali `Sweep → MSS → FVG`. Entry, SL, TP, skor dan urutan yang ada dipertahankan. Regresi BUY/SELL memverifikasi geometri serta mencegah atribusi hasil ke driver yang belum diimplementasikan.

Lima detector yang tidak ada dicatat sebagai pekerjaan implementasi. Tidak ada algoritme trading baru yang dibuat dari tebakan, aktivasi driver, atau deployment dalam patch ini.

Validasi lokal: 21 pemeriksaan terarah lulus; npm test: seluruh 144 file regresi lulus. git diff --check lulus.
