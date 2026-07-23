# Amy FX Multi-Timeframe Entry Watch

## Tujuan

Mengganti Entry Map lama sebagai kontrak entry utama. Arah tetap berasal dari **Validated Direction Forecast**. Mesin entry hanya menentukan level yang dipantau dan kapan reaksi level berubah menjadi entry atau pembatalan.

## Timeframe

| Level asal | Trigger sweep |
|---|---|
| M5 | M1 |
| M15 | M5 |
| H1 | M5 |
| H4 | M15 |

Level asal dapat berupa FVG, Order Block, SSL untuk rencana BUY, atau BSL untuk rencana SELL.

## Lifecycle

### Pantau

Level terdekat yang searah Direction Forecast dibekukan sebagai level utama. Mesin tidak berpindah level selama level tersebut belum selesai.

### Sweep menjadi entry

- BUY: wick candle trigger turun melewati level, kemudian candle yang sama close kembali di atas level.
- SELL: wick candle trigger naik melewati level, kemudian candle yang sama close kembali di bawah level.

Sweep tidak boleh memakai candle yang masih berjalan.

### Break membatalkan entry

Break hanya sah berdasarkan close timeframe asal level:

- BUY batal jika candle timeframe asal close di bawah batas level.
- SELL batal jika candle timeframe asal close di atas batas level.

Wick yang menembus level tanpa close tidak dianggap break.

## Perubahan fungsi setelah Valid Break

- FVG ditembus → iFVG dengan arah berlawanan.
- Order Block ditembus → Breaker Block dengan arah berlawanan.
- SSL/BSL ditembus → Valid Break struktur dengan arah penembusan.

Level hasil konversi hanya boleh dipantau ulang ketika Direction Forecast sudah searah dengan fungsi barunya.

## Proteksi

- Entry Map lama tetap disimpan sebagai data audit, tetapi tidak boleh menjadi `bestSetup`.
- Data usang tidak boleh menghasilkan level pantauan atau entry.
- Konflik Direction Forecast menghasilkan WAIT.
- Scanner hanya memantau level; keputusan sweep atau valid break tetap memakai candle closed.
- SL dan target yang dibentuk setelah trigger sweep masih merupakan default engineering dan belum boleh dianggap hasil backtest baru.

## Pengujian awal

`tests/entry-watch-engine.test.mjs` mengunci:

1. Sumber level M5, M15, H1, H4.
2. Trigger H1 melalui M5.
3. Sweep dan close reclaim menjadi entry.
4. Close timeframe asal menjadi Valid Break.
5. FVG → iFVG.
6. Order Block → Breaker Block.
7. Liquidity → Valid Break.
8. Level yang sedang dipantau tidak meloncat ke kandidat lain.
