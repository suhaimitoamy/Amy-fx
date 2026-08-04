#!/usr/bin/env python3
"""Adapt Preview regression assertions to the Amy FX production release identity."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OVERLAY_MANIFEST = ROOT / "tools/production-test-overlays.txt"
PRODUCTION_OVERLAYS = {
    line.strip()
    for line in OVERLAY_MANIFEST.read_text(encoding="utf-8").splitlines()
    if line.strip()
} if OVERLAY_MANIFEST.exists() else set()

EXCLUDED_PREVIEW_TESTS = {
    "blueprint-preview-stabilization.test.mjs",
    "blueprint-preview-v1.test.mjs",
    "personal-source-debug.test.mjs",
}

POSITIVE_REPLACEMENTS = {
    "preview-update.json": "update.json",
    r"preview-update\.json": r"update\.json",
    "personal/amyfx-private/preview-update.json": "main/update.json",
    r"personal\/amyfx-private\/preview-update\.json": r"main\/update\.json",
    "2.0.0-preview.310": "2.3.1",
    r"2\.0\.0-preview\.310": r"2\.3\.1",
    "2.0.0-preview.307": "2.3.1",
    r"2\.0\.0-preview\.307": r"2\.3\.1",
    "2.3.0": "2.3.1",
    r"2\.3\.0": r"2\.3\.1",
    "2.2.1": "2.3.1",
    r"2\.2\.1": r"2\.3\.1",
    "940310": "59",
    "940307": "59",
    "code: 58": "code: 59",
    "code 58": "code 59",
    "code: 57": "code: 59",
    "code 57": "code 59",
    r"\?: 58\)": r"\?: 59\)",
    r"\?: 57\)": r"\?: 59\)",
    r"code:\s*58": r"code:\s*59",
    r"code:\s*57": r"code:\s*59",
    "<= 58": "<= 59",
    "<= 57": "<= 59",
    "Amy FX Preview": "Amy FX",
    "com.amyelitesuite.learningpreview": "com.amyelitesuite",
    r"com\.amyelitesuite\.learningpreview": r"com\.amyelitesuite",
    "amyfxpreview": "amyfx",
    "amyfx.preview.scalper.permanent-history.v1": "amyfx.production.scalper.permanent-history.v1",
    r"amyfx\.preview\.scalper\.permanent-history\.v1": r"amyfx\.production\.scalper\.permanent-history\.v1",
}

NEGATIVE_ASSERTION_MARKERS = (
    "doesNotMatch",
    "not.match",
    "includes(",
    "=== false",
    ", false)",
)


def excluded(path: Path) -> bool:
    if path.name in EXCLUDED_PREVIEW_TESTS:
        return True
    return path.name.startswith("preview-") and path.name != "preview-production-feature-parity.test.mjs"


def normalize_line(line: str) -> str:
    if any(marker in line for marker in NEGATIVE_ASSERTION_MARKERS):
        return line
    updated = line
    for old, new in POSITIVE_REPLACEMENTS.items():
        updated = updated.replace(old, new)
    return updated


changed = 0
removed = 0
preserved = 0
for path in (ROOT / "tests").glob("*.test.mjs"):
    if excluded(path):
        path.unlink()
        removed += 1
        continue
    if path.name in PRODUCTION_OVERLAYS:
        preserved += 1
        continue
    original = path.read_text(encoding="utf-8")
    updated = "".join(normalize_line(line) for line in original.splitlines(keepends=True))
    if updated != original:
        path.write_text(updated, encoding="utf-8")
        changed += 1

print(
    f"Normalized {changed} Preview regressions for Amy FX production 2.3.1 (59); "
    f"preserved {preserved} production overlays; excluded {removed} Preview-only tests."
)
