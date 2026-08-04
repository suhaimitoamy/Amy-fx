#!/usr/bin/env python3
"""Adapt Preview regression assertions to the Amy FX production release identity."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPLACEMENTS = {
    "preview-update.json": "update.json",
    "2.0.0-preview.307": "2.3.0",
    "940307": "58",
    "Amy FX Preview": "Amy FX",
    "com.amyelitesuite.learningpreview": "com.amyelitesuite",
    "amyfxpreview": "amyfx",
}

changed = 0
for path in (ROOT / "tests").glob("*.test.mjs"):
    original = path.read_text(encoding="utf-8")
    updated = original
    for old, new in REPLACEMENTS.items():
        updated = updated.replace(old, new)
    if updated != original:
        path.write_text(updated, encoding="utf-8")
        changed += 1

print(f"Normalized {changed} Preview regression test files for Amy FX production 2.3.0 (58).")
