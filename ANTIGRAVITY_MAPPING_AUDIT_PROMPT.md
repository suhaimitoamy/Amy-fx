Kerjakan repo Amy FX berdasarkan file:

docs/MAPPING_LOGIC_AUDIT_PLAN.md

Baca seluruh isi file plan dari awal sampai akhir.

Tugas:
1. Audit semua checklist di docs/MAPPING_LOGIC_AUDIT_PLAN.md.
2. Buat laporan:
   docs/MAPPING_LOGIC_AUDIT_REPORT.md
3. Pisahkan hasil:
   - PASS
   - FAIL / BUG NYATA
   - VERIFY / PERLU DICEK
   - RISIKO LOGIKA
4. Patch hanya bug nyata yang terbukti dari kode.
5. Jangan patch item yang hanya VERIFY atau potensi risiko.
6. Jangan hapus fitur.
7. Jangan rollback.
8. Jangan refactor besar.
9. Jangan tambah fitur baru.
10. Jangan sentuh Supabase / SQLite / native bridge kalau tidak berhubungan langsung dengan bug Mapping.

Fokus utama:
- app/src/main/assets/apps/mapping/index.html
- app/src/main/java/com/amyelitesuite/MainActivity.kt
- app/src/main/java/com/amyelitesuite/ScannerService.kt
- app/src/main/java/com/amyelitesuite/AmyFxNotificationGate.java
- app/src/main/java/com/amyelitesuite/MappingLogicCore.kt

Fitur wajib tetap ada:
- Dashboard
- Analyze
- AMY FX Decision
- Valid Break Info
- Amy FX Mapping Explanation
- Setup Aktif
- History / Event Logs
- Settings & API
- Save & Connect API
- WebSocket live price
- Background Scanner ON/OFF
- Notification
- Navigation tab: Dashboard, Analyze, Setup, History, Settings

Bug prioritas jika terbukti:
- Status Connected tapi harga tidak bergerak.
- Cache/localStorage menampilkan data lama sebagai data baru.
- Setup Aktif menampilkan setup lama atau invalid.
- Valid Break Info salah membaca candle break.
- AMY FX Decision bertentangan dengan bias/setup.
- Scanner menerima target salah.
- Background Scanner ON/OFF tidak sinkron.
- Notification spam.
- Tap notification salah tab.
- Build Gradle gagal.

Setelah patch:
1. Update docs/MAPPING_LOGIC_AUDIT_REPORT.md
2. Jalankan:
   ./gradlew assembleDebug --no-configuration-cache --stacktrace
3. Jika build gagal, catat error di report.
4. Commit:
   fix(mapping): apply mapping logic audit findings

Jangan hapus docs/MAPPING_LOGIC_AUDIT_PLAN.md.
