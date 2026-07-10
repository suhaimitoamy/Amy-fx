#!/data/data/com.termux/files/usr/bin/bash
set -e

chmod +x scripts/cleanup-production.sh || true
bash scripts/cleanup-production.sh

python3 scripts/patch-mainactivity-production.py

git add -A
git status

echo
echo "Jika status sudah benar:"
echo "git commit -m \"production upgrade phase 2\""
echo "git push origin main"
