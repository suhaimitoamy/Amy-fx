#!/data/data/com.termux/files/usr/bin/bash
set -e

STAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE_DIR="docs/archive/cleanup_$STAMP"
mkdir -p "$ARCHIVE_DIR"

move_if_exists() {
  for item in "$@"; do
    if [ -e "$item" ]; then
      mkdir -p "$ARCHIVE_DIR/$(dirname "$item")"
      mv "$item" "$ARCHIVE_DIR/$item"
      echo "moved: $item -> $ARCHIVE_DIR/$item"
    fi
  done
}

# Root-level temporary patch scripts/files
for f in apply-*.sh *.patch patch_apk.py fix-note.txt amyfx-logic-code-fix.patch; do
  [ -e "$f" ] && move_if_exists "$f"
done

# Backup folders committed to main
for d in .amyfx_backup_final_* .amyfx_backup_*; do
  [ -e "$d" ] && move_if_exists "$d"
done

# Consolidate old fix notes into archive.
for f in *_FIX_NOTES.md *FIX_NOTE*.md; do
  [ -e "$f" ] && move_if_exists "$f"
done

echo "cleanup done. review $ARCHIVE_DIR before push."
