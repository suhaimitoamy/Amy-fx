# Amy FX

Amy FX adalah aplikasi Android hybrid untuk pemetaan dan pemantauan market **XAU/USD**. Antarmuka berjalan melalui WebView lokal, sedangkan notifikasi, background scanner, penyimpanan, Firebase Messaging, unduhan, dan pembaruan aplikasi ditangani oleh Kotlin native.

> **Versi publik:** `2.0.2`  
> **Version code:** `53`

## Pemisahan Produk

Repository ini memiliki dua jalur permanen yang tidak saling menggantikan:

| Branch | Produk | Fungsi |
|---|---|---|
| `main` | **Amy FX** | Aplikasi publik yang stabil dan menerima fitur matang. |
| `personal/amyfx-private` | **Amy FX Preview** | Aplikasi personal, eksperimen, dan pengembangan lanjutan. |

Promosi fitur Preview ke `main` tidak menghapus atau mengubah branch `personal/amyfx-private`. Konfigurasi personal, APK Preview, workflow Preview, backend eksperimen, dan update channel pribadi tidak dimasukkan ke aplikasi publik.

## Identitas Amy FX Publik

- **Nama aplikasi:** Amy FX
- **Application ID:** `com.amyelitesuite`
- **URI scheme:** `amyfx`
- **Minimum Android:** Android 8.0 / API 26
- **Target SDK:** Android SDK 35
- **Update manifest:** `main/update.json`
- **APK rolling:** `AmyFX-latest.apk`
- **Signing:** sertifikat produksi permanen yang kompatibel dengan instalasi Amy FX lama

## Fitur Utama 2.0.2

- Harga live Mapping memakai Twelve Data WebSocket dengan timestamp asli provider.
- Riwayat candle, snapshot, dan analisis Mapping tetap memakai jalur REST → Supabase tanpa menaikkan frekuensi refresh yang sudah ada.
- Batch candle dideduplikasi sebelum upsert agar satu candle tidak dikirim dua kali pada konflik database yang sama.
- Mapping market lintas timeframe dengan kontrak freshness yang konsisten.
- Rencana Eksekusi: BUY, SELL, atau WAIT; area pantauan, entry, trigger, konfirmasi, SL, TP1, TP2, RR, target struktural, dan invalidasi.
- Lifecycle setup dan Entry Watch dengan terminal outcome yang konsisten.
- Tampilan Mapping lebih stabil tanpa render penuh berulang, kedipan, atau perpindahan scroll saat refresh biasa.
- Panel Scalper Shadow tetap tersedia secara permanen dan mempertahankan data valid terakhir saat backend sedang refresh atau sementara tidak tersedia.
- Rekonsiliasi lifecycle Scalper Shadow mencegah respons lama menimpa status terbaru atau terminal.
- Market Intelligence untuk news, heatmap, dan liquidity.
- Amy Mentor yang dapat memakai konteks Beranda, Mapping, Market Intelligence, Academy, dan Journal.
- Jurnal Trading dan materi pembelajaran dalam aplikasi.

## Struktur Utama

```text
app/src/main/assets/                  WebView assets
app/src/main/assets/apps/mapping      Mapping dan Rencana Eksekusi
app/src/main/assets/apps/market-intel News, heatmap, dan liquidity
app/src/main/assets/apps/journal      Jurnal Trading
app/src/main/assets/apps/academy      Materi belajar
app/src/main/java/                    Android native Kotlin dan FCM
api/                                  Serverless market endpoints
lib/                                  Shared backend logic
tests/                                Regression tests
.github/workflows/                    CI, validasi, dan release publik
```

## Validasi Produksi

Setiap kandidat publik memeriksa:

- seluruh regression test JavaScript;
- Android release unit test;
- Android lint;
- build APK release signed;
- package `com.amyelitesuite`;
- label `Amy FX`;
- version name dan version code;
- APK Signature Scheme v1 dan v2;
- fingerprint signer produksi;
- sumber update `main/update.json`.

`update.json` baru diaktifkan setelah APK publik berhasil dibangun, diverifikasi, dan diunggah. Dengan demikian, pengguna tidak menerima penawaran update sebelum file APK yang sesuai tersedia.
