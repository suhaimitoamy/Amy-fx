#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Jalankan script ini dari root repo Amy-fx."
  exit 1
fi
git apply --whitespace=fix amyfx-logic-code-fix.patch
echo "Patch logic/code berhasil diterapkan."
