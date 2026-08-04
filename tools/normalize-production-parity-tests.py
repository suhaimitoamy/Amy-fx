#!/usr/bin/env python3
"""Adapt Preview regression assertions to the Amy FX production release identity."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Apply identity substitutions only to positive assertions and fixtures. Negative
# assertions must keep Preview markers so they continue proving that Preview
# package names, URI schemes, APK paths, and update channels do not leak into
# production.
POSITIVE_REPLACEMENTS = {
    "preview-update.json": "update.json",
    r"preview-update\.json": r"update\.json",
    "personal/amyfx-private/preview-update.json": "main/update.json",
    r"personal\/amyfx-private\/preview-update\.json": r"main\/update\.json",
    "2.0.0-preview.307": "2.3.0",
    r"2\.0\.0-preview\.307": r"2\.3\.0",
    "2.2.1": "2.3.0",
    r"2\.2\.1": r"2\.3\.0",
    "940307": "58",
    "code: 57": "code: 58",
    "code 57": "code 58",
    r"\?: 57\)": r"\?: 58\)",
    r"code:\s*57": r"code:\s*58",
    "<= 57": "<= 58",
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


def normalize_line(line: str) -> str:
    # Keep explicit negative assertions intact. This also preserves their test
    # value after the runtime itself is promoted to the production identity.
    if any(marker in line for marker in NEGATIVE_ASSERTION_MARKERS):
        return line
    updated = line
    for old, new in POSITIVE_REPLACEMENTS.items():
        updated = updated.replace(old, new)
    return updated


changed = 0
for path in (ROOT / "tests").glob("*.test.mjs"):
    original = path.read_text(encoding="utf-8")
    updated = "".join(normalize_line(line) for line in original.splitlines(keepends=True))
    if updated != original:
        path.write_text(updated, encoding="utf-8")
        changed += 1

print(f"Normalized {changed} Preview regression test files for Amy FX production 2.3.0 (58).")
