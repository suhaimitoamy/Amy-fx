# Amy FX

Aplikasi gabungan Amy FX.

Struktur utama:

- Amy Elite Suite sebagai dashboard utama Android.
- Mapping / AI Chart Analyzer sebagai module lokal.
- Trading Library / Jurnal sebagai module lokal.
- Amy Trading Academy sebagai module lokal.
- Indikator TradingView sebagai library lokal.

Module lokal berada di:

```
app/src/main/assets/apps/
├── mapping/
├── journal/
├── academy/
└── indikator/
```

Build APK:

```bash
chmod +x gradlew
./gradlew assembleDebug --no-configuration-cache --stacktrace
```
