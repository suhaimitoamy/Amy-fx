# Amy FX

Amy FX adalah aplikasi Android hybrid untuk pemetaan dan pemantauan market **XAU/USD**. Antarmuka berjalan melalui WebView lokal, sedangkan notifikasi, background scanner, penyimpanan, Firebase Messaging, unduhan, dan pembaruan aplikasi ditangani oleh Kotlin native.

> **Versi publik:** `2.1.0`  
> **Version code:** `54`

## Produk Terpadu

`main` adalah satu-satunya jalur aplikasi dan rilis aktif untuk Amy FX. Fitur matang dari Amy FX Preview telah dikonsolidasikan ke produksi agar aplikasi, update channel, sinkronisasi candle, dan Scalper Engine tidak berjalan sebagai jalur ganda.

Branch `personal/amyfx-private` tetap dapat dipertahankan sebagai arsip riwayat pengembangan, tetapi bukan lagi aplikasi, backend, APK, workflow rilis, atau update channel yang aktif. Tidak ada artefak Amy FX Preview yang diterbitkan dari `main`.

## Identitas Amy FX Produksi

- **Nama aplikasi:** Amy FX
- **Application ID:** `com.amyelitesuite`
- **URI scheme:** `amyfx`
- **Minimum Android:** Android 8.0 / API 26
- **Target SDK:** Android SDK 35
- **Update manifest:** `main/update.json`
- **APK rolling:** `AmyFX-latest.apk`
- **Signing:** sertifikat produksi permanen yang kompatibel dengan instalasi Amy FX lama

## Fitur Utama 2.1.0

- Harga live XAU/USD tetap memakai WebSocket Twelve Data langsung.
- REST Twelve Data dipusatkan ke satu sinkronisasi candle M1 dan seluruh konsumen membaca Supabase.
- Timeframe lebih besar dibentuk dari candle tersimpan tanpa request provider terpisah per modul.
- Scalper Engine membaca candle Supabase dan menjadi otoritas keputusan eksekusi untuk driver, entry, SL, TP, dan lifecycle.
- Mapping tetap menjadi sumber konteks struktur, likuiditas, HTF, regime, dealing location, dan alasan market.
- Setup engine atau driver legacy tidak lagi ditampilkan sebagai setup aktif.
- Rencana Eksekusi, Entry Watch, scanner, dan notifikasi memakai keputusan eksekusi yang sama.
- Academy menyimpan materi, heading, persentase, posisi scroll, serta riwayat baca terakhir.
- Mapping market lintas timeframe dengan kontrak freshness yang konsisten.
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
supabase/functions/                   Sinkronisasi candle dan Scalper Engine
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
