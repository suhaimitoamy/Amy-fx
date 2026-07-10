# Amy FX Final 8 Bug Fix

Diperbaiki:
1. Heads-up notification memakai channel baru HIGH/PRIORITY_MAX dan permission Manage All Files ditambahkan.
2. Jurnal: tombol Amy FX diperkecil, Reset/Pilih disembunyikan saat tidak relevan, panel API key AI ditambahkan untuk ChatGPT/OpenAI, DeepSeek, Gemini.
3. Indikator: manifest lokal dibuat fallback embedded + XHR fallback agar tidak kosong/error saat fetch file lokal gagal.
4. Academy: folder admin/index.html dibuat agar menu Admin tidak ERR_FILE_NOT_FOUND.
5. Mapping: semua timeframe M1, M5, M15, M30, H1, H4, D1, W1 benar-benar fetch/analyze masing-masing.
6. Tombol/logo Amy FX native diperkecil agar tidak menutupi teks.
7. Mapping logic diganti dengan engine ICT lokal: swing, BOS/CHOCH, displacement FVG, OB berbasis candle lawan sebelum break, liquidity, premium/discount, HTF bias, setup score.
8. Mapping dikembalikan ke tujuan awal: market context menyeluruh + signal watch + BSL/SSL target + background scanner target.

Catatan:
- Supabase tidak diubah.
- Academy tetap tanpa password.
- Setelah install APK baru, kalau notifikasi belum heads-up, buka App Info > Notifications > Amy FX Heads-Up Alerts > aktifkan Pop on screen/Heads-up.
