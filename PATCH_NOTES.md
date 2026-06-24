Patch tambahan background hardening:
- ScannerService foreground notification dibuat persistent/ongoing.
- WebSocket reconnect saat failure dan closed.
- Watchdog restart WebSocket jika tidak ada tick lebih dari 2 menit.
- BootReceiver dan manifest sudah dipush ke GitHub, tapi file ini disiapkan bila ScannerService.kt perlu diganti manual.

Cara pakai dari root repo amy-elite-suite:
cp app/src/main/java/com/amyelitesuite/ScannerService.kt app/src/main/java/com/amyelitesuite/ScannerService.kt.bak
cp /path/ke/ScannerService.kt app/src/main/java/com/amyelitesuite/ScannerService.kt
./gradlew assembleDebug
