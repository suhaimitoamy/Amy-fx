# Amy FX Architecture

Amy FX memakai arsitektur hybrid: Android Kotlin sebagai host native dan WebView lokal sebagai UI/module utama.

## Native Layer

Native Android bertugas untuk:

- WebView host.
- Notification channel.
- Foreground scanner service.
- WebSocket live price.
- SQLite candle cache.
- File export via MediaStore.
- Secure API key storage.

## Web Layer

Web assets berada di:

```text
app/src/main/assets/
```

Module utama:

```text
apps/mapping
apps/journal
apps/academy
apps/indikator
```

## Mapping sebagai Sumber Analisa

Mapping tetap menjadi sumber utama analisa ICT. Scanner native hanya memantau target BSL/SSL yang dikirim dari Mapping.

```text
Mapping -> target BSL/SSL -> ScannerService -> Android Notification -> Deep Link ke Mapping
```

## Scanner Rules

- Cooldown alert: 30 menit per level.
- Target expire: 24 jam.
- Reconnect bertahap: 15 detik, 30 detik, 60 detik, 2 menit, 5 menit, lalu 10 menit.
- Channel foreground bersifat silent LOW priority.
- Channel target alert bersifat HIGH priority.

## Data Storage

Candle disimpan di SQLite:

```text
amy_market_data.sqlite
candles(symbol, timeframe, open_time)
```

Retention:

- M1/M5/M15/M30: 90 hari.
- H1/H4/D1: 1 tahun.
