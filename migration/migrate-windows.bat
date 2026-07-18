@echo off
setlocal EnableExtensions EnableDelayedExpansion

set PACKAGE=com.amyelitesuite
set EXPECTED_VERSION=1.4.12-debug
set MIGRATION_APK=%~1
if "%MIGRATION_APK%"=="" set MIGRATION_APK=AmyFX-1.4.15-migration.apk
set WORK_DIR=amyfx-migration-backup
set BACKUP_FILE=%WORK_DIR%\amyfx-data.tar
set ROLLBACK_APK=%WORK_DIR%\AmyFX-1.4.12-debug-rollback.apk

where adb >nul 2>nul || goto :NO_ADB
where tar >nul 2>nul || goto :NO_TAR
if not exist "%MIGRATION_APK%" goto :NO_APK

if not exist "%WORK_DIR%" mkdir "%WORK_DIR%"
adb get-state 2>nul | findstr /x device >nul || goto :NO_DEVICE
adb shell pm path %PACKAGE% >nul 2>nul || goto :NO_OLD_APP

set VERSION=
for /f "tokens=2 delims==" %%V in ('adb shell dumpsys package %PACKAGE% ^| findstr /c:"versionName="') do if not defined VERSION set VERSION=%%V
set VERSION=%VERSION: =%
if not "%VERSION%"=="%EXPECTED_VERSION%" goto :WRONG_VERSION

adb shell run-as %PACKAGE% id >nul 2>nul || goto :NOT_DEBUGGABLE

for /f "tokens=2 delims=:" %%P in ('adb shell pm path %PACKAGE% ^| findstr /b package:') do if not defined OLD_APK_PATH set OLD_APK_PATH=%%P
if not defined OLD_APK_PATH goto :NO_OLD_PATH
set OLD_APK_PATH=%OLD_APK_PATH: =%
adb pull "%OLD_APK_PATH%" "%ROLLBACK_APK%" >nul || goto :ROLLBACK_COPY_FAILED
if not exist "%ROLLBACK_APK%" goto :ROLLBACK_COPY_FAILED

adb shell am force-stop %PACKAGE% >nul
adb exec-out run-as %PACKAGE% sh -c "cd /data/user/0/%PACKAGE% && tar -cf - ." > "%BACKUP_FILE%"
if not exist "%BACKUP_FILE%" goto :BACKUP_FAILED
for %%S in ("%BACKUP_FILE%") do if %%~zS LSS 1024 goto :BACKUP_FAILED
tar -tf "%BACKUP_FILE%" >nul 2>nul || goto :BACKUP_FAILED

 echo.
 echo Backup berhasil dibuat dan APK lama sudah disimpan.
 echo Folder pemulihan: %CD%\%WORK_DIR%
 echo.
 set /p CONFIRM=Ketik LANJUT untuk mengganti paket dan memulihkan data: 
 if not "%CONFIRM%"=="LANJUT" goto :CANCELLED

adb uninstall %PACKAGE% || goto :MIGRATION_FAILED
adb install "%MIGRATION_APK%" || goto :MIGRATION_FAILED
adb shell run-as %PACKAGE% id >nul 2>nul || goto :MIGRATION_FAILED
adb shell am force-stop %PACKAGE% >nul 2>nul
adb shell "run-as %PACKAGE% sh -c 'cd /data/user/0/%PACKAGE% && tar -xf -'" < "%BACKUP_FILE%" || goto :MIGRATION_FAILED
adb shell am force-stop %PACKAGE% >nul 2>nul
adb shell monkey -p %PACKAGE% -c android.intent.category.LAUNCHER 1 >nul 2>nul

 echo.
 echo MIGRASI SELESAI.
 echo Periksa seluruh catatan di Amy FX sebelum menghapus folder %WORK_DIR%.
 pause
 exit /b 0

:MIGRATION_FAILED
 echo.
 echo Migrasi gagal. Mengembalikan Amy FX lama dan data cadangan...
 adb uninstall %PACKAGE% >nul 2>nul
 adb install "%ROLLBACK_APK%"
 adb shell am force-stop %PACKAGE% >nul 2>nul
 adb shell "run-as %PACKAGE% sh -c 'cd /data/user/0/%PACKAGE% && tar -xf -'" < "%BACKUP_FILE%"
 adb shell monkey -p %PACKAGE% -c android.intent.category.LAUNCHER 1 >nul 2>nul
 echo Amy FX lama telah dicoba dipulihkan. Jangan hapus folder %WORK_DIR%.
 pause
 exit /b 1

:NO_ADB
echo ADB belum tersedia. Instal Android Platform Tools lalu jalankan lagi.
goto :END_ERROR
:NO_TAR
echo Perintah tar tidak tersedia pada Windows ini.
goto :END_ERROR
:NO_APK
echo APK migrasi tidak ditemukan: %MIGRATION_APK%
goto :END_ERROR
:NO_DEVICE
echo Hubungkan tepat satu HP dan izinkan USB debugging.
goto :END_ERROR
:NO_OLD_APP
echo Amy FX lama tidak ditemukan.
goto :END_ERROR
:WRONG_VERSION
echo Versi terpasang adalah %VERSION%. Script ini khusus %EXPECTED_VERSION%.
goto :END_ERROR
:NOT_DEBUGGABLE
echo Amy FX lama tidak dapat dibaca melalui run-as. Proses dihentikan sebelum data diubah.
goto :END_ERROR
:NO_OLD_PATH
echo Lokasi APK lama tidak ditemukan.
goto :END_ERROR
:ROLLBACK_COPY_FAILED
echo Gagal menyimpan APK lama untuk rollback. Proses dihentikan.
goto :END_ERROR
:BACKUP_FAILED
echo Backup data gagal atau rusak. Aplikasi belum dihapus.
goto :END_ERROR
:CANCELLED
echo Migrasi dibatalkan. Aplikasi lama tidak diubah.
goto :END_ERROR

:END_ERROR
pause
exit /b 1
