#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_DIR="$ROOT_DIR/emulator-fixture"
LOG_FILE="$FIXTURE_DIR/migration-test.log"
PACKAGE="com.amyelitesuite"

mkdir -p "$FIXTURE_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1
set -x

adb install "$FIXTURE_DIR/AmyFX-1.4.12-debug.apk"
adb shell run-as "$PACKAGE" id
adb shell "run-as $PACKAGE sh -c 'mkdir -p files shared_prefs app_webview && printf note-survived > files/public-note.txt && printf prefs-survived > shared_prefs/public-test.xml && printf webview-survived > app_webview/public-webview.txt'"
test "$(adb shell "run-as $PACKAGE cat /data/user/0/$PACKAGE/files/public-note.txt" | tr -d '\r')" = "note-survived"

mkdir -p "$FIXTURE_DIR/run"
cp "$FIXTURE_DIR/AmyFX-1.4.15-migration.apk" "$FIXTURE_DIR/run/"
cp "$ROOT_DIR/migration/migrate-termux.sh" "$FIXTURE_DIR/run/"
cd "$FIXTURE_DIR/run"
printf 'LANJUT\n' | bash migrate-termux.sh AmyFX-1.4.15-migration.apk

test "$(adb shell "run-as $PACKAGE cat /data/user/0/$PACKAGE/files/public-note.txt" | tr -d '\r')" = "note-survived"
test "$(adb shell "run-as $PACKAGE cat /data/user/0/$PACKAGE/shared_prefs/public-test.xml" | tr -d '\r')" = "prefs-survived"
test "$(adb shell "run-as $PACKAGE cat /data/user/0/$PACKAGE/app_webview/public-webview.txt" | tr -d '\r')" = "webview-survived"
adb shell dumpsys package "$PACKAGE" | grep -F 'versionName=1.4.15-migration'
find . -path '*amyfx-migration-*/amyfx-data.tar' -type f -size +1k | grep .
