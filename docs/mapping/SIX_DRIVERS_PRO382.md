# Pro382 — evaluasi enam driver dan setup Mapping

Versi: 2.0.0-pro.382 / 950382. Engine: amyfx-six-drivers-pro382. Aturan: six-driver-rules-v1.

Permintaan user mengaktifkan kembali evaluasi keenam driver setelah audit. Implementasi ini mendefinisikan aturan operasional yang sebelumnya tidak tersedia dalam source. Ini bukan reproduksi klaim backtest/WR lama yang artefaknya tidak ada di repo.

## Aturan aktif

M15 tetap otoritas arah melalui Dashboard AMY. H1 memberi konteks/bonus kualitas, bukan veto. Candle tertutup dan berurutan wajib; pivot baru dapat digunakan setelah candle konfirmasinya ditutup. Skor kualitas driver bukan win rate dan tidak menjadi gate entry. Dashboard A+ serta kebijakan push konteks tetap terpisah.

| Driver | Setup dan entry | Exit/manajemen |
| --- | --- | --- |
| Sniper | Sweep reclaim sebelum break M15; anchor ekstrem sweep/impuls dibekukan. Retest zona 75–78,6%, lalu break + displacement M5. Limit midpoint zona setelah observasi. | SL ekstrem struktur ±0,1 ATR M15 sebelum impuls (buffer minimal $0,05); TP 0,8R; hold 60 menit. |
| Adaptive | BOS continuation searah EMA20 M15 dan bias M15. Pullback 50–61,8%, konfirmasi M5; limit midpoint setelah observasi. | TP 1,6R; setelah close mencapai +0,8R, SL simulasi ke entry untuk candle berikutnya; hold 180 menit. Pemindahan sekali ke BE, tidak diklaim sebagai trailing. |
| Swing CHoCH | Close menembus pivot melawan bias M15 sebelumnya; body impuls ≥2×ATR sebelum impuls. Zona 75% ±0,5%; konfirmasi M5 lalu limit midpoint. | SL struktural, TP 0,8R, hold 180 menit. |
| Ensemble | ≥2 model dasar searah dalam 30 menit; Shield tidak menjadi vote ganda. Zona 72,5% ±0,5%; ATR M15 ≥$2,5 dalam unit harga XAU; konfirmasi M5 lalu limit. | SL struktural, TP 0,8R, hold 90 menit. Quorum adalah kesesuaian pola struktural dasar, bukan dua posisi yang harus sudah filled. Bukti antar-model dapat berkorelasi; tidak diklaim independen statistik. |
| Shield | BOS continuation dan EMA20 M15; pullback 61,8–70,5%, konfirmasi M5 lalu limit. Maksimal satu rencana/posisi model Shield. | TP 0,7R; hold 90 menit. Risiko acuan 0,25% untuk keputusan manual. Blokir rencana baru pada hasil model harian UTC ≤−2R, atau cooldown 60 menit setelah dua kerugian berurutan. Tidak memiliki akses saldo/posisi broker. |
| Rapid | Retest break M15 ±0,15ATR; konfirmasi M5. London 08–12 Europe/London atau NY 08–12 America/New_York, mengikuti DST. Next open setelah observasi. | TP 1,3R; hold 45 menit. Early exit jika close rugi ≥0,35R sekaligus melewati balik level break M5. Harga exit adalah close aktual teramati; tidak dijanjikan tepat −0,35R. |

Break M15 dasar memiliki body ≥0,6ATR sebelumnya. Konfirmasi M5 menggunakan pivot lokal terkonfirmasi, close menembus pivot, body searah ≥0,6ATR M5 sebelumnya, dan retest zona setelah formation. Retest dapat mendahului trigger pada candle lain, maksimal 30 menit. Zona berakhir 2 jam setelah impuls; trigger baru harus ≤15 menit.

Likuiditas searah harus masih aktif dan cukup jauh untuk target fixed-R. Sumbernya pivot M15 terkonfirmasi atau PDH/PDL dari D1 tertutup. Target yang sudah disapu tidak diaktifkan kembali. Tidak ada TP fallback buatan. Kalender terverifikasi, tidak ada news lock, data segar dan geometri harga valid merupakan gate keamanan.

## Lifecycle dan pencatatan

- ID deterministik per engine/driver/arah/impuls mencegah setup ganda dan resurrection setelah terminal. Satu rencana live per driver; enam model bisa dievaluasi bersamaan.
- Limit baru aktif sesudah observasi server. Formation/trigger bar dan candle masa depan tidak dapat mengisi order. Rapid menggunakan open teramati sesudah observasi. Batas entry 15 menit sejak observasi.
- Harga fill mengunci risk aktual dan target/BE dihitung ulang dari risk itu. Gap >0,5ATR atau ruang likuiditas habis membatalkan entry.
- M1 teramati dipakai untuk fill/exit bila cakupan tersedia; M5 menjadi fallback. Pada limit yang filled intrabar, target/BE pada fill bar tidak diklaim tercapai sebelum fill.
- Stop diperiksa lebih dahulu jika OHLC menyentuh TP dan SL sekaligus. Gap stop menggunakan open yang lebih buruk; hasil dapat kurang dari −1R. Gap data/urutan ambigu ditandai dan dikecualikan dari statistik WR/R terukur.
- BE berlaku setelah close pemicu, pada candle berikutnya. Early cut dan expiry memakai TIME_EXIT dengan alasan tersimpan. Posisi aktif tetap dikelola saat news lock; rencana yang belum filled dibatalkan.
- Statistik server: hasil selesai hari UTC, WIN berdasarkan R positif, LOSS negatif, BE nol, denominator seluruh hasil terukur termasuk BE/time exit. Biaya broker belum tersedia sehingga R ditandai bruto; ini bukan net expectancy atau profit nyata.

## Integrasi

`scalper-engine` menyimpan plan/lifecycle ke tabel setup yang sudah ada dan menyimpan enam evaluasi/alasan/checklist/statistik di run result. Constraint model diperluas melalui migration tanpa menghapus arsip. `scalper-setups` menampilkan plan engine baru; row engine lama tidak dihidupkan kembali. Riwayat perangkat tetap terisolasi; plan pasar engine baru dibagikan dan difilter menggunakan preferensi enam driver perangkat.

Mapping menampilkan setup di Konteks, enam evaluasi dan ON/OFF di Detail, alasan menunggu, geometri dan statistik bruto. Pilihan plan menggambar entry/SL/TP dari server; refresh memperbarui SL/target dan offline/expiry mencabut otoritas level. Halaman statistik memakai realized R model baru, termasuk BE gap dan time exit; outcome ambigu tidak menjadi WIN.

## Validasi dan batas

Regresi deterministik mencakup BUY/SELL seluruh enam driver, parity definisi frontend/backend, look-ahead, pivot/ATR kausal, gap candle, OTE limit, next-open, news/calendar/device gate, SL/TP ambigu, gap loss, BE, early cut, expiry, Shield, statistik dan API scope. Replay 240 candle M5 produksi digunakan untuk validasi struktur/lifecycle; kalender memakai fixture sintetis terverifikasi dan biaya/intrabar tidak tersedia, sehingga tidak dipresentasikan sebagai backtest performa.

Replay contoh menghasilkan satu kandidat Rapid, driver lain menunggu. Tidak ada jaminan enam driver selalu menghasilkan setup atau frekuensi harian tertentu. Angka 2×ATR dan OTE tetap selektif; kalibrasi kualitas membutuhkan data dan backtest terpisah.

Validasi lokal Pro382: seluruh 146 file regresi lulus; 21 kasus driver/lifecycle + 2 kasus API baru, BUY/SELL keenam model. Browser mobile 360/390, enam kartu/toggle, filter OFF, refresh detail, mode gelap, offline dan tanpa overflow/pageerror. Replay 240 M5 produksi: satu kandidat Rapid; fixture kalender sintetis, bukan backtest profit. Migration constraint applied; scalper-engine25, scalper-setups11, scalper-preferences2 deployed. Build signed dan manifest masih menunggu publikasi.


Pro382 release verification completed: source 11239e1de1b42d6677cbd074619c636507d762ab; signed Actions36792997261 and lint36792997230 succeeded. Public update.json enabled at2.0.0-pro.382/950382. Downloaded31,534,089-byte APK SHA25634f42b0f0e34995e7df9ff0a425e3e68b74ec59acfa531f08f0ea007d4b32b3f matches manifest/checksum; all11 changed assets match source.146 regression files pass. Production engine25/setup-reader11/preferences2 active; five engine files byte-identical to source and successful live run returns all6 driver evaluations. Browser360/390 light/dark, toggles, detail refresh, selected chart, offline and overflow checks pass. Replay240 M5 with synthetic calendar produced one Rapid candidate; not a profitability backtest. Earlier build/deployment-pending notes are resolved. Actual Android update receipt remains unobserved.
