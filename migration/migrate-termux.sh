#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

PACKAGE="com.amyelitesuite"
EXPECTED_VERSION="1.4.12-debug"
MIGRATION_APK="${1:-AmyFX-1.4.15-migration.apk}"
STAMP="$(date +%Y%m%d-%H%M%S)"
WORK_DIR="${PWD}/amyfx-migration-${STAMP}"
BACKUP_FILE="${WORK_DIR}/amyfx-data.tar"
ROLLBACK_DIR="${WORK_DIR}/rollback-apk"
LOG_FILE="${WORK_DIR}/migration.log"
MIGRATION_STARTED=0

mkdir -p "$ROLLBACK_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

fail() {
  echo
  echo "GAGAL: $*"
  echo "Data cadangan tetap berada di: $WORK_DIR"
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "Perintah '$1' belum tersedia."
}

restore_old_app() {
  echo
  echo "Mencoba mengembalikan Amy FX lama..."
  adb uninstall "$PACKAGE" >/dev/null 2>&1 || true

  mapfile -t rollback_apks < <(find "$ROLLBACK_DIR" -maxdepth 1 -type f -name '*.apk' | sort)
  if [ "${#rollback_apks[@]}" -eq 0 ]; then
    echo "APK rollback tidak ditemukan. Cadangan data tetap aman di $BACKUP_FILE"
    return 1
  elif [ "${#rollback_apks[@]}" -eq 1 ]; then
    adb install "${rollback_apks[0]}" || return 1
  else
    adb install-multiple "${rollback_apks[@]}" || return 1
  fi

  adb shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
  adb shell "run-as $PACKAGE sh -c 'cd /data/user/0/$PACKAGE && tar -xf -'" < "$BACKUP_FILE" || return 1
  adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
  echo "Amy FX lama dan datanya telah dikembalikan."
}

on_error() {
  local exit_code=$?
  if [ "$MIGRATION_STARTED" -eq 1 ]; then
    restore_old_app || true
  fi
  exit "$exit_code"
}
trap on_error ERR

need adb
need tar
need sha256sum

[ -f "$MIGRATION_APK" ] || fail "APK migrasi tidak ditemukan: $MIGRATION_APK"

mapfile -t devices < <(adb devices | awk 'NR>1 && $2=="device" {print $1}')
[ "${#devices[@]}" -eq 1 ] || fail "Hubungkan tepat satu perangkat melalui Wireless debugging/ADB."

adb shell pm path "$PACKAGE" >/dev/null 2>&1 || fail "Amy FX lama tidak ditemukan."

version_name="$(adb shell dumpsys package "$PACKAGE" | sed -n 's/^[[:space:]]*versionName=//p' | head -n1 | tr -d '\r')"
echo "Versi terpasang: ${version_name:-tidak terbaca}"
[ "$version_name" = "$EXPECTED_VERSION" ] || fail "Script ini hanya untuk Amy FX $EXPECTED_VERSION."

adb shell run-as "$PACKAGE" id >/dev/null 2>&1 || fail "Amy FX terpasang tidak dapat dibaca dengan run-as. Jangan lanjutkan."

printf '%s\n' "Menyimpan APK lama untuk rollback..."
mapfile -t installed_paths < <(adb shell pm path "$PACKAGE" | sed 's/^package://' | tr -d '\r')
[ "${#installed_paths[@]}" -gt 0 ] || fail "Lokasi APK lama tidak ditemukan."
index=0
for remote_path in "${installed_paths[@]}"; do
  index=$((index + 1))
  adb pull "$remote_path" "$ROLLBACK_DIR/rollback-${index}.apk" >/dev/null
  [ -s "$ROLLBACK_DIR/rollback-${index}.apk" ] || fail "Gagal menyimpan APK rollback."
done

printf '%s\n' "Menghentikan Amy FX dan membuat backup data internal..."
adb shell am force-stop "$PACKAGE"
adb exec-out run-as "$PACKAGE" sh -c "cd /data/user/0/$PACKAGE && tar -cf - ." > "$BACKUP_FILE"
[ -s "$BACKUP_FILE" ] || fail "File backup kosong."
tar -tf "$BACKUP_FILE" >/dev/null || fail "File backup rusak."
backup_size="$(wc -c < "$BACKUP_FILE" | tr -d ' ')"
backup_hash="$(sha256sum "$BACKUP_FILE" | awk '{print $1}')"
echo "Backup berhasil: $backup_size byte"
echo "SHA-256 backup: $backup_hash"

cat <<EOF

Backup sudah diverifikasi dan APK lama sudah disimpan untuk rollback.
Tahap berikutnya akan mengganti paket debug dengan paket resmi, lalu mengembalikan data.
Folder pemulihan: $WORK_DIR
EOF
read -r -p "Ketik LANJUT untuk memulai migrasi: " confirmation
[ "$confirmation" = "LANJUT" ] || fail "Migrasi dibatalkan sebelum aplikasi diubah."

MIGRATION_STARTED=1
adb uninstall "$PACKAGE"
adb install "$MIGRATION_APK"

new_version="$(adb shell dumpsys package "$PACKAGE" | sed -n 's/^[[:space:]]*versionName=//p' | head -n1 | tr -d '\r')"
echo "Versi migrasi terpasang: ${new_version:-tidak terbaca}"
adb shell run-as "$PACKAGE" id >/dev/null 2>&1 || fail "APK migrasi tidak debuggable; data belum dipulihkan."

printf '%s\n' "Memulihkan catatan, database, dan penyimpanan WebView..."
adb shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true
adb shell "run-as $PACKAGE sh -c 'cd /data/user/0/$PACKAGE && tar -xf -'" < "$BACKUP_FILE"
adb shell am force-stop "$PACKAGE" >/dev/null 2>&1 || true

restored_check="$(adb shell "run-as $PACKAGE sh -c 'find /data/user/0/$PACKAGE -maxdepth 2 -type f | head -n 5'" | tr -d '\r')"
[ -n "$restored_check" ] || fail "Tidak ada file hasil pemulihan yang terdeteksi."

MIGRATION_STARTED=0
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true

echo
echo "MIGRASI SELESAI."
echo "Buka Amy FX dan periksa catatan sebelum menghapus folder: $WORK_DIR"
echo "Jangan hapus backup sampai seluruh data sudah kamu pastikan lengkap."
