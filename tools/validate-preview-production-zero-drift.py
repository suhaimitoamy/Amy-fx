#!/usr/bin/env python3
"""Verify that production runtime is the normalized Amy FX Preview runtime.

This validator is intentionally committed by the repository owner after the
generated parity commit so GitHub executes the complete trusted PR checks.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

TEXT_EXTENSIONS = {".html", ".js", ".mjs", ".ts", ".css", ".json", ".kt", ".kts", ".xml", ".md", ".txt"}
COMPARE_ROOTS = [
    "app/src/main/assets/apps",
    "app/src/main/java/com/amyelitesuite",
    "supabase/functions/scalper-engine",
    "supabase/functions/scalper-setups",
    "supabase/functions/scalper-system-push",
]
COMPARE_FILES = [
    "app/src/main/assets/app.js",
    "app/src/main/assets/index.html",
    "app/src/main/assets/profile-system-settings-v1.js",
    "app/proguard-rules.pro",
    "api/heatmap.js",
    "api/liquidity.js",
    "api/twelvedata.js",
    "lib/market-candle-store.mjs",
]
REMOVED_FROM_PRODUCTION = {
    "app/src/main/assets/apps/market-intel/private-market-api-router.js",
}
REPLACEMENTS = {
    "https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/personal/amyfx-private/preview-update.json":
        "https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/main/update.json",
    "personal/amyfx-private/preview-update.json": "main/update.json",
    "com.amyelitesuite.learningpreview": "com.amyelitesuite",
    "amyfxpreview://": "amyfx://",
    "amyfxpreview": "amyfx",
    "AmyFX-Preview-latest.apk": "AmyFX-latest.apk",
    "preview-news-system-push": "news-system-push",
    "Amy FX Preview": "Amy FX",
    "aktif dalam simulasi Preview": "aktif dalam simulasi Amy FX",
    "simulasi Preview": "simulasi Amy FX",
    "amyfx.preview.scalper.permanent-history.v1": "amyfx.production.scalper.permanent-history.v1",
}


def fail(message: str) -> None:
    raise SystemExit(f"[production-zero-drift] {message}")


def normalized_preview_bytes(path: Path, relative: str) -> bytes:
    data = path.read_bytes()
    if path.suffix.lower() not in TEXT_EXTENSIONS:
        return data
    text = data.decode("utf-8")
    for old, new in REPLACEMENTS.items():
        text = text.replace(old, new)
    if relative == "app/src/main/assets/apps/market-intel/index.html":
        text = text.replace('  <script src="private-market-api-router.js"></script>\n', "")
        text = text.replace('<script src="private-market-api-router.js"></script>\n', "")
    return text.encode("utf-8")


def collect(root: Path, relative_root: str) -> dict[str, Path]:
    base = root / relative_root
    if not base.exists():
        fail(f"missing comparison root: {relative_root}")
    return {
        file.relative_to(root).as_posix(): file
        for file in base.rglob("*")
        if file.is_file()
    }


def compare_root(preview: Path, production: Path, relative_root: str) -> int:
    expected = collect(preview, relative_root)
    actual = collect(production, relative_root)
    for removed in REMOVED_FROM_PRODUCTION:
        expected.pop(removed, None)
    if set(expected) != set(actual):
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        fail(f"file-set drift in {relative_root}; missing={missing[:8]}, extra={extra[:8]}")
    checked = 0
    for relative, source in expected.items():
        if normalized_preview_bytes(source, relative) != actual[relative].read_bytes():
            fail(f"content drift: {relative}")
        checked += 1
    return checked


def compare_file(preview: Path, production: Path, relative: str) -> int:
    source = preview / relative
    target = production / relative
    if not source.exists() or not target.exists():
        fail(f"missing parity file: {relative}")
    if normalized_preview_bytes(source, relative) != target.read_bytes():
        fail(f"content drift: {relative}")
    return 1


def main() -> None:
    if len(sys.argv) != 3:
        fail("usage: validate-preview-production-zero-drift.py <preview-root> <production-root>")
    preview = Path(sys.argv[1]).resolve()
    production = Path(sys.argv[2]).resolve()
    checked = sum(compare_root(preview, production, root) for root in COMPARE_ROOTS)
    checked += sum(compare_file(preview, production, file) for file in COMPARE_FILES)

    metadata_path = production / "docs/amyfx-production-preview-parity.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    expected_sha = os.environ.get("AMYFX_PREVIEW_SOURCE_SHA", "")
    if expected_sha and metadata.get("source_commit") != expected_sha:
        fail("recorded Preview source commit does not match checked-out Preview HEAD")
    if metadata.get("production_version") != "2.3.1" or metadata.get("production_version_code") != 59:
        fail("production release identity is not 2.3.1 (59)")

    print(f"Amy FX production has zero runtime drift across {checked} files from Preview {expected_sha[:12] or 'unknown'}; only production identity and topology overlays differ.")


if __name__ == "__main__":
    main()
