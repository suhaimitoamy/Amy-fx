# Amy FX Preview — Blueprint Upgrade v1.0

Branch implementasi: `experiment/heatmap-news-20260722`  
Baseline sumber: Amy FX `1.5.9` / versionCode `50`  
Identitas Preview: `com.amyelitesuite.learningpreview` / `amyfxpreview`  
Production `main`: tidak diubah.

## Tujuan

Blueprint ini mengubah Amy FX Preview menjadi jalur percobaan aman untuk Trading Operating System dan Amy AI Mentor lintas modul. Semua perubahan memakai adapter, feature flag, migrasi idempotent, release signed yang immutable, dan update channel Preview terpisah.

## Artefak yang diterapkan

1. **Kontrak canonical** — Market Snapshot, Decision, Setup Event, Liquidity Snapshot, Journal Entry v2, Context Envelope, Conversation, dan Migration Ledger.
2. **Setup lifecycle** — `DATA_INVALID`, `WAIT`, `WATCH`, `ARMED`, `TRIGGERED`, `MANAGEMENT`, `TP`, `SL`, `EXPIRED`, `CANCELLED`, `REPLACED`.
3. **Freshness/TTL** — timestamp UTC, tampilan WITA, soft stale, hard expired, serta status yang terlihat pada UI.
4. **Global Amy Mentor** — overlay tunggal pada Beranda, Mapping, Market Intel, Jurnal, dan Academy dengan context chips dan prompt starter per modul.
5. **Secure AI vault** — API key disimpan native melalui `EncryptedSharedPreferences`; WebView hanya menerima metadata masked dan referensi key.
6. **Provider routing** — Gemini, OpenRouter, dan DeepSeek melalui allowlist endpoint, timeout, cancel, fallback, rate guard, dan kategori error tersanitasi.
7. **Migrasi aman** — key lama dipindahkan satu kali ke vault; jurnal lama dikopi ke schema v2; ledger menyimpan checkpoint dan bukti migrasi.
8. **Command Center** — status module, freshness, journal summary, migration health, serta akses Amy global.
9. **Journal feedback loop** — Plan → Execution → Outcome → satu tindakan berikutnya, local-first.
10. **Notification ledger** — event ID, expiry, deduplikasi, dan notifikasi native tanpa spam.
11. **Performance guard** — satu MutationObserver terjadwal per halaman, refresh 30 detik ketika halaman aktif, tanpa loop DOM sub-detik.
12. **Release gate** — JavaScript regression, Android unit test, lint, signed APK, package/version/signer verification, checksum, immutable prerelease, lalu aktivasi manifest.

## Pemetaan 13 fase blueprint

| Fase | Implementasi Preview | Gate |
|---|---|---|
| 0 | Branch terpisah, baseline, package/signer/update lock | main tidak berubah |
| 1 | Schema catalog dan validator runtime | contract test |
| 2 | Market snapshot, UTC/WITA, freshness/TTL | stale/expired terlihat |
| 3 | Decision, setup lifecycle, liquidity label | state canonical tersedia |
| 4 | Global app shell, module health, event bus | UI lint/regression |
| 5 | Amy Mentor global dan Context Envelope | context per modul |
| 6 | Migrasi key/jurnal + Migration Ledger | idempotent checkpoint |
| 7 | Mapping context dan WAIT discipline | no AI market truth |
| 8 | Intel/Academy context dan source labels | news bukan sinyal |
| 9 | Command Center dan proactive ledger | event deduplication |
| 10 | Journal v2 feedback loop | local-first persistence |
| 11 | secure vault, performance, privacy | native/JS tests |
| 12 | signed immutable release dan update manifest | versionCode > 920011 |

## Rollback

- Feature flag dapat mematikan shell, mentor, command center, lifecycle, journal v2, atau proactive insight secara terpisah.
- Data legacy tidak dihapus sebelum key berhasil tersimpan di vault dan ledger berstatus `success`.
- APK Preview tetap memakai package dan sertifikat Preview yang sama sehingga rollback dilakukan lewat version berikutnya, bukan mengganti identitas aplikasi.
- Manifest baru diaktifkan hanya setelah APK signed, checksum, dan release asset tersedia.

## Definition of Done

- Semua gate CI lulus.
- APK memiliki package `com.amyelitesuite.learningpreview` dan sertifikat Preview permanen.
- versionCode lebih tinggi dari instalasi `920011`.
- `preview-update.json` pada branch Preview menunjuk ke APK immutable yang sudah tersedia.
- Amy FX Preview menampilkan popup/notifikasi pembaruan saat pemeriksa update berjalan.
- Tidak ada commit atau push ke `main`.
