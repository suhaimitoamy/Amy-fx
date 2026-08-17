#!/usr/bin/env python3
"""Normalize Pro 326 + production overlay regressions for Amy FX 2.4.0."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TESTS = ROOT / "tests"

REPLACEMENTS = {
    "2.0.0-pro.326": "2.4.0",
    r"2\.0\.0-pro\.326": r"2\.4\.0",
    "950326": "60",
    "2.3.1": "2.4.0",
    r"2\.3\.1": r"2\.4\.0",
    "code: 59": "code: 60",
    "code 59": "code 60",
    "sourceCode, 59": "sourceCode, 60",
    "versionCode, 59": "versionCode, 60",
    "VERSION_CODE, 59": "VERSION_CODE, 60",
    r"code:\s*59": r"code:\s*60",
    r"\?: 59\)": r"\?: 60\)",
    "<= 59": "<= 60",
    "Amy FX Pro": "Amy FX",
    "com.amyelitesuite.learningpreview": "com.amyelitesuite",
    r"com\.amyelitesuite\.learningpreview": r"com\.amyelitesuite",
    "amyfxpreview": "amyfx",
    "AmyFX-Pro-latest.apk": "AmyFX-latest.apk",
    "AmyFX-Preview-latest.apk": "AmyFX-latest.apk",
    "suhaimitoamy/Amy-fx-pro/main/update.json": "suhaimitoamy/Amy-fx/main/update.json",
    "amyfx.preview.scalper.permanent-history.v1": "amyfx.production.scalper.permanent-history.v1",
    r"amyfx\.preview\.scalper\.permanent-history\.v1": r"amyfx\.production\.scalper\.permanent-history\.v1",
}

NEGATIVE_MARKERS = (
    "doesNotMatch",
    "not.match",
    "notMatch",
    "=== false",
    ", false)",
)

changed = 0
for path in TESTS.glob("*.test.mjs"):
    original = path.read_text(encoding="utf-8")
    lines = []
    for line in original.splitlines(keepends=True):
        if any(marker in line for marker in NEGATIVE_MARKERS):
            lines.append(line)
            continue
        updated = line
        for old, new in REPLACEMENTS.items():
            updated = updated.replace(old, new)
        lines.append(updated)
    normalized = "".join(lines)
    if normalized != original:
        path.write_text(normalized, encoding="utf-8")
        changed += 1

print(f"Normalized {changed} Pro/production test files for Amy FX 2.4.0 (60).")
