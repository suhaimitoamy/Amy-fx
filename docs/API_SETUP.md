# API Setup

## TwelveData

Amy FX memakai TwelveData untuk live price XAU/USD.

API key tidak boleh ditulis ke source code. Simpan melalui UI aplikasi atau secure storage native.

## Secure Storage

API key disimpan melalui `SecurePrefs.kt` menggunakan `EncryptedSharedPreferences`.

Fallback legacy `SharedPreferences` masih dibaca agar user lama tidak langsung kehilangan konfigurasi.

## Supabase

Supabase digunakan sebagai candle source fallback.

Konfigurasi yang dibutuhkan:

- Supabase URL.
- Supabase anon key.
- Table `candles`.

Format minimum table:

```text
symbol TEXT
timeframe TEXT
open_time INTEGER
close_time INTEGER
open REAL
high REAL
low REAL
close REAL
volume_tick INTEGER
is_closed INTEGER
```
