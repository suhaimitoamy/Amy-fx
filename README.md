# Amy FX

Amy FX adalah aplikasi Android hybrid untuk pemetaan dan pemantauan market **XAU/USD**. Antarmuka utama berjalan melalui WebView lokal, sedangkan notifikasi, background scanner, penyimpanan, Firebase Messaging, download, dan pembaruan aplikasi ditangani oleh Kotlin native.

> **Versi:** `1.5.8`
>
> **Version code:** `49`
> **Minimum Android:** Android 8.0 / API 26  
> **Target SDK:** Android SDK 35  
> **Application ID:** `com.amyelitesuite`

[Download APK resmi Amy FX](https://github.com/suhaimitoamy/Amy-fx/releases/download/amyfx-latest/AmyFX-latest.apk)

## Disclaimer

Amy FX bukan robot trading, Expert Advisor, atau penasihat keuangan. Aplikasi tidak membuka atau menutup order otomatis dan tidak menjamin profit. Seluruh hasil Mapping, Market Outlook, berita, liquidity, heatmap, dan setup merupakan alat bantu analisis. Keputusan serta risiko tetap berada pada pengguna.

## Modul Utama

| Modul | Fungsi |
|---|---|
| **Mapping** | Struktur market, HTF bias, BSL/SSL, OB, FVG, premium/discount, valid break, setup, dan Market Outlook |
| **Berita** | Berita relevan XAU/USD, risiko berita, Dynamic Heatmap, liquidity, dan market briefing |
| **Jurnal Trading** | Catatan trade, statistik performa, trade plan, evaluasi, filter, autosave, dan export |
| **Tutorial Trading** | Materi belajar trading terstruktur di dalam aplikasi |
| **Indikator TradingView** | Library indikator dan file Pine Script |
| **Dashboard** | Akses cepat ke seluruh modul Amy FX |

## Update v1.5.8 — Jurnal dan Rotasi API AI

- Kalender dan halaman Jurnal kembali membaca data tersimpan dari sumber IndexedDB yang sama.
- Tanggal jurnal dapat diklik untuk membuka riwayat jurnal pada tanggal tersebut.
- Kalender menampilkan nominal Win berwarna hijau dan Loss berwarna merah.
- Asisten AI tidak lagi terkunci tanpa jawaban setelah proses gagal atau selesai.
- Banyak API key Gemini dan OpenRouter dapat dirotasi otomatis dengan timeout dan cooldown.
- DeepSeek tersedia sebagai fallback berbayar terakhir yang dapat dinonaktifkan.
