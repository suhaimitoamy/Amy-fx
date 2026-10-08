#!/usr/bin/env python3
"""Promote Amy FX Pro 2.0.0-pro.326 runtime into Amy FX production.

Amy FX Pro is the canonical feature/runtime source. Production identity, package,
URI, update channel, signer workflow, news topology and Market Intel routing stay
owned by suhaimitoamy/Amy-fx.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
from pathlib import Path

VERSION = "2.4.0"
VERSION_CODE = 60
SOURCE_VERSION = "2.0.0-pro.326"
SOURCE_CODE = 950326
SOURCE_SHA = "50c80c9ceb0c34dccc91d9d4da48e26d22455ba2"
TEXT_EXTENSIONS = {".html", ".js", ".mjs", ".ts", ".css", ".json", ".kt", ".kts", ".xml", ".md", ".txt"}

REPLACE_DIRS = [
    "app/src/main/assets",
    "app/src/main/java/com/amyelitesuite",
    "app/src/main/res",
    "supabase/functions/scalper-engine",
    "supabase/functions/scalper-setups",
    "supabase/functions/scalper-system-push",
    "supabase/functions/smt-dxy-candles",
    "tests",
]
REPLACE_FILES = [
    "app/proguard-rules.pro",
]
MERGE_DIRS = [
    "supabase/migrations",
]


def fail(message: str) -> None:
    raise SystemExit(f"[pro-326-to-production] {message}")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def replace_entry(source_root: Path, target_root: Path, relative: str) -> None:
    source = source_root / relative
    target = target_root / relative
    if not source.exists():
        fail(f"canonical Pro source is missing {relative}")
    if source.is_dir():
        if target.exists():
            shutil.rmtree(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source, target)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def merge_dir(source_root: Path, target_root: Path, relative: str) -> None:
    source = source_root / relative
    target = target_root / relative
    if not source.exists():
        return
    target.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, target, dirs_exist_ok=True)


def text_files(root: Path):
    if root.is_file():
        if root.suffix.lower() in TEXT_EXTENSIONS:
            yield root
        return
    if not root.exists():
        return
    for file in root.rglob("*"):
        if file.is_file() and file.suffix.lower() in TEXT_EXTENSIONS:
            yield file


def sanitize(paths: list[Path]) -> None:
    replacements = {
        "https://raw.githubusercontent.com/suhaimitoamy/Amy-fx-pro/main/update.json":
            "https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/main/update.json",
        "suhaimitoamy/Amy-fx-pro/main/update.json": "suhaimitoamy/Amy-fx/main/update.json",
        "com.amyelitesuite.learningpreview": "com.amyelitesuite",
        "amyfxpreview://": "amyfx://",
        "amyfxpreview": "amyfx",
        "AmyFX-Pro-latest.apk": "AmyFX-latest.apk",
        "AmyFX-Preview-latest.apk": "AmyFX-latest.apk",
        "preview-news-system-push": "news-system-push",
        "Amy FX Pro": "Amy FX",
        "amyfx.preview.scalper.permanent-history.v1": "amyfx.production.scalper.permanent-history.v1",
        SOURCE_VERSION: VERSION,
        str(SOURCE_CODE): str(VERSION_CODE),
    }
    for root in paths:
        for file in text_files(root):
            original = read(file)
            updated = original
            for old, new in replacements.items():
                updated = updated.replace(old, new)
            if updated != original:
                write(file, updated)


def patch_production_identity(target: Path) -> None:
    gradle_path = target / "app/build.gradle.kts"
    gradle = read(gradle_path)
    gradle, c1 = re.subn(
        r'versionCode = \(System\.getenv\("AMYFX_VERSION_CODE"\)\?\.toIntOrNull\(\) \?: \d+\)',
        f'versionCode = (System.getenv("AMYFX_VERSION_CODE")?.toIntOrNull() ?: {VERSION_CODE})',
        gradle,
        count=1,
    )
    gradle, c2 = re.subn(
        r'versionName = System\.getenv\("AMYFX_VERSION_NAME"\) \?: "[^"]+"',
        f'versionName = System.getenv("AMYFX_VERSION_NAME") ?: "{VERSION}"',
        gradle,
        count=1,
    )
    if c1 != 1 or c2 != 1:
        fail("unable to patch Amy FX production Gradle version")
    write(gradle_path, gradle)

    version_path = target / "app/src/main/assets/app-version.js"
    version = read(version_path)
    version = version.replace("Amy FX — based on Amy FX Preview 316 canonical Amy-SMC-D closed-candle Mapping engine.",
                              "Amy FX production — Pro 326 feature/runtime parity release.")
    version, count = re.subn(
        r"name:\s*'[^']+',\s*code:\s*\d+",
        f"name: '{VERSION}', code: {VERSION_CODE}",
        version,
        count=1,
    )
    if count != 1:
        fail("unable to patch Amy FX production web version")
    version = version.replace(
        "https://raw.githubusercontent.com/suhaimitoamy/Amy-fx-pro/main/update.json",
        "https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/main/update.json",
    )
    write(version_path, version)


def validate(target: Path) -> None:
    required = [
        "app/src/main/assets/apps/academy/trading-practice/index.html",
        "app/src/main/assets/apps/academy/trading-practice/assets/js/chart-engine.js",
        "app/src/main/assets/apps/academy/trading-practice/assets/js/zip-reader.js",
        "app/src/main/assets/apps/academy/backtest-learning/index.html",
        "app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js",
        "app/src/main/assets/apps/mapping/js/scalper-execution-authority.js",
        "app/src/main/assets/apps/mapping/js/engine/structural-bias.js",
        "supabase/functions/scalper-engine/drivers.mjs",
        "supabase/functions/smt-dxy-candles/index.ts",
        "app/src/main/java/com/amyelitesuite/TwelveDataPriceBridge.kt",
    ]
    for relative in required:
        if not (target / relative).exists():
            fail(f"required Pro parity file missing: {relative}")

    gradle = read(target / "app/build.gradle.kts")
    for marker in [
        '?: "com.amyelitesuite"',
        '?: "Amy FX"',
        '?: "amyfx"',
        f"?: {VERSION_CODE})",
        f'?: "{VERSION}"',
    ]:
        if marker not in gradle:
            fail(f"production Gradle identity missing: {marker}")

    app_version = read(target / "app/src/main/assets/app-version.js")
    for marker in [
        f"name: '{VERSION}', code: {VERSION_CODE}",
        "suhaimitoamy/Amy-fx/main/update.json",
    ]:
        if marker not in app_version:
            fail(f"production web identity missing: {marker}")

    forbidden = [
        "com.amyelitesuite.learningpreview",
        "amyfxpreview",
        "suhaimitoamy/Amy-fx-pro/main/update.json",
        "AmyFX-Pro-latest.apk",
        "Amy FX Pro",
    ]
    for root in [target / "app/src/main", target / "supabase/functions"]:
        for file in text_files(root):
            content = read(file)
            for marker in forbidden:
                if marker in content:
                    fail(f"Pro identity leaked into {file.relative_to(target)}: {marker}")


def main() -> None:
    if len(sys.argv) != 3:
        fail("usage: promote-pro-326-to-production.py <pro-root> <production-root>")
    source = Path(sys.argv[1]).resolve()
    target = Path(sys.argv[2]).resolve()

    actual_sha = os.environ.get("AMYFX_PRO_SOURCE_SHA", "")
    if actual_sha and actual_sha != SOURCE_SHA:
        fail(f"source SHA mismatch: expected {SOURCE_SHA}, got {actual_sha}")

    for relative in REPLACE_DIRS + REPLACE_FILES:
        replace_entry(source, target, relative)
    for relative in MERGE_DIRS:
        merge_dir(source, target, relative)

    copied_roots = [target / relative for relative in REPLACE_DIRS + REPLACE_FILES + MERGE_DIRS]
    sanitize(copied_roots)
    patch_production_identity(target)

    metadata = {
        "source_repository": "suhaimitoamy/Amy-fx-pro",
        "source_branch": "main",
        "source_commit": actual_sha or SOURCE_SHA,
        "source_version": SOURCE_VERSION,
        "production_version": VERSION,
        "production_version_code": VERSION_CODE,
        "strategy": "pro-326-runtime-parity-with-production-identity-preserved",
    }
    write(target / "docs/amyfx-production-pro-parity.json", json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    validate(target)
    print(f"Promoted Amy FX Pro {SOURCE_VERSION}@{metadata['source_commit'][:12]} to Amy FX {VERSION} ({VERSION_CODE}).")


if __name__ == "__main__":
    main()
