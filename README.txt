Amy FX Notification Spam Fix

Cara pakai di Termux:

cd /storage/emulated/0/Download/aplikasi/amy-elite-suite
cp /storage/emulated/0/Download/amy_notification_spam_fix.zip .
unzip -o amy_notification_spam_fix.zip -d .
python3 apply_notification_spam_fix.py
git add app/src/main/java/com/amyelitesuite/ScannerService.kt
git commit -m "fix: throttle scanner market alert spam"
git push origin main
