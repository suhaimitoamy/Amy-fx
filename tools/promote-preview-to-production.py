#!/usr/bin/env python3
"""Promote Amy FX Preview runtime modules into the production branch safely.

The source tree is expected to be a checkout of personal/amyfx-private. The
production checkout remains authoritative for package identity, URI scheme,
signing, update channel, release artifacts, and user data.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
from pathlib import Path

PRODUCTION_VERSION = "2.3.0"
PRODUCTION_CODE = 58


def fail(message: str) -> None:
    raise SystemExit(f"[preview-to-production] {message}")


def copy_entry(source_root: Path, target_root: Path, relative: str) -> None:
    source = source_root / relative
    target = target_root / relative
    if not source.exists():
        fail(f"missing Preview source: {relative}")
    if source.is_dir():
        if target.exists():
            shutil.rmtree(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source, target)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def replace_required(content: str, old: str, new: str, label: str) -> str:
    if old not in content:
        fail(f"cannot patch {label}: marker not found: {old}")
    return content.replace(old, new)


def text_files(root: Path):
    extensions = {".html", ".js", ".mjs", ".ts", ".css", ".json", ".kt", ".kts", ".xml", ".md", ".txt"}
    if root.is_file():
        if root.suffix.lower() in extensions:
            yield root
        return
    if not root.exists():
        return
    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in extensions:
            yield path


def sanitize_production_identity(paths: list[Path]) -> None:
    replacements = {
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
    }
    for root in paths:
        for file in text_files(root):
            original = read(file)
            updated = original
            for old, new in replacements.items():
                updated = updated.replace(old, new)
            if updated != original:
                write(file, updated)


def patch_production_versions(target_root: Path) -> None:
    gradle_path = target_root / "app/build.gradle.kts"
    gradle = read(gradle_path)
    gradle, code_count = re.subn(
        r'versionCode = \(System\.getenv\("AMYFX_VERSION_CODE"\)\?\.toIntOrNull\(\) \?: \d+\)',
        f'versionCode = (System.getenv("AMYFX_VERSION_CODE")?.toIntOrNull() ?: {PRODUCTION_CODE})',
        gradle,
        count=1,
    )
    gradle, name_count = re.subn(
        r'versionName = System\.getenv\("AMYFX_VERSION_NAME"\) \?: "[^"]+"',
        f'versionName = System.getenv("AMYFX_VERSION_NAME") ?: "{PRODUCTION_VERSION}"',
        gradle,
        count=1,
    )
    if code_count != 1 or name_count != 1:
        fail("production Gradle version markers could not be updated")
    write(gradle_path, gradle)

    app_version_path = target_root / "app/src/main/assets/app-version.js"
    app_version = read(app_version_path)
    app_version, count = re.subn(
        r"name:\s*'[^']+',\s*code:\s*\d+",
        f"name: '{PRODUCTION_VERSION}', code: {PRODUCTION_CODE}",
        app_version,
        count=1,
    )
    if count != 1:
        fail("production web version marker could not be updated")
    app_version = app_version.replace(
        "// Amy FX production release identity.",
        "// Amy FX production release identity — Preview engine parity release.",
    )
    write(app_version_path, app_version)


def patch_release_workflow(path: Path) -> None:
    content = read(path)
    content = content.replace("2.2.1", PRODUCTION_VERSION)
    content = re.sub(r"(?<!\d)57(?!\d)", str(PRODUCTION_CODE), content)
    old_marker = "grep -Fq '10 driver BT6/BT6.1 + AMD' app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js"
    new_marker = "\n".join([
        "grep -Fq 'SCALPER ENGINE · SHADOW MODE' app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js",
        "          grep -Fq 'scalper-setups?limit=50' app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js",
        "          grep -Fq 'reconcileScalperPayload' app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js",
    ])
    if old_marker in content:
        content = content.replace(old_marker, new_marker)

    old_summary = (
        "Amy FX 2.3.0 menyimpan cache candle tervalidasi antarsesi, memverifikasi freshness berdasarkan candle closed, "
        "membatasi refresh M1 latar belakang, dan memakai fallback Supabase yang masih aktual tanpa menghabiskan kuota "
        "Twelve Data. Harga live tetap memakai native WebSocket dan engine trading tidak diubah."
    )
    new_summary = (
        "Amy FX 2.3.0 menyelaraskan engine produksi dengan Amy FX Preview: Mapping closed-candle runtime v5, Market State "
        "BT7.1, structural bias, Rencana Eksekusi, Entry Watch, Scalper Engine, riwayat setup permanen, dan tampilan terbaru. "
        "Identitas produksi, signer, update channel, harga live WebSocket, serta data pengguna tetap dipertahankan."
    )
    content = content.replace(old_summary, new_summary)

    old_notes = [
        "Cache candle Mapping kini bertahan setelah aplikasi ditutup sehingga pembukaan ulang tidak mengulang request yang tidak perlu.",
        "Freshness diverifikasi dari waktu candle closed terbaru, bukan hanya dari timer pengambilan data.",
        "Refresh M1 latar belakang dibatasi lima menit; M1 tetap mengikuti penutupan satu menit saat timeframe M1 sedang dipilih.",
        "Fallback Supabase yang masih aktual dapat dipakai ketika provider terganggu atau kuota REST terbatas.",
        "Harga live tetap memakai native Twelve Data WebSocket; engine Mapping, Scalper, lifecycle, identitas produksi, signing, dan data pengguna tidak diubah.",
    ]
    new_notes = [
        "Engine Mapping produksi kini setara dengan Amy FX Preview, termasuk closed-candle runtime v5, Mapping Accuracy V3, dan stabilitas tampilan.",
        "Market State memakai rekonsiliasi struktur BT7.1 serta structural bias independen dengan prioritas bias tervalidasi.",
        "Rencana Eksekusi, Entry Watch, Scalper Entry Watch, execution authority, dan decision bridge memakai implementasi terbaru Preview.",
        "Riwayat setup Scalper tersimpan dan dapat dibuka kembali; lifecycle TP1, TP2, Stop Loss, expired, serta notifikasi tetap konsisten.",
        "Identitas produksi, package com.amyelitesuite, URI amyfx, signing permanen, update channel main, harga live WebSocket, dan data pengguna tetap dipertahankan.",
    ]
    for old, new in zip(old_notes, new_notes):
        content = content.replace(old, new)

    validation_anchor = (
        "grep -Fq \"CURRENT_ENGINE_VERSION = 'amyfx-preview-scalper-pattern-v3.0'\" "
        "app/src/main/assets/apps/mapping/js/scalper-execution-authority.js"
    )
    validation_addition = "\n".join([
        validation_anchor,
        "          grep -Fq \"version: '5.0.0'\" app/src/main/assets/apps/mapping/js/mapping-runtime-repair-v3.js",
        "          test -f app/src/main/assets/apps/mapping/js/engine/structural-bias.js",
        "          grep -Fq 'classifySwingSequence' app/src/main/assets/apps/mapping/js/engine/structural-bias.js",
        "          test -f app/src/main/assets/apps/mapping/js/scalper-execution-decision-bridge.js",
    ])
    if validation_anchor in content and "classifySwingSequence" not in content:
        content = content.replace(validation_anchor, validation_addition)

    write(path, content)


def validate(target_root: Path) -> None:
    required = [
        "app/src/main/assets/apps/mapping/js/mapping-runtime-repair-v3.js",
        "app/src/main/assets/apps/mapping/js/engine/bt71-market-state-reconciliation.js",
        "app/src/main/assets/apps/mapping/js/engine/structural-bias.js",
        "app/src/main/assets/apps/mapping/js/execution-plan-core.js",
        "app/src/main/assets/apps/mapping/js/execution-plan-ui.js",
        "app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js",
        "app/src/main/assets/apps/mapping/js/scalper-execution-authority.js",
        "app/src/main/assets/apps/mapping/js/scalper-execution-decision-bridge.js",
        "app/src/main/assets/apps/mapping/js/scalper-shadow-state.js",
        "app/src/main/assets/apps/mapping/js/live-price-display-only-v1.js",
        "app/src/main/java/com/amyelitesuite/TwelveDataPriceBridge.kt",
        "app/src/main/java/com/amyelitesuite/AmyFxAiBridge.kt",
        "supabase/functions/scalper-engine/engine.mjs",
        "supabase/functions/scalper-engine/pattern-gates.mjs",
        "supabase/functions/scalper-setups/index.ts",
        "supabase/functions/scalper-system-push/index.ts",
    ]
    for relative in required:
        if not (target_root / relative).exists():
            fail(f"required production parity file missing: {relative}")

    markers = {
        "app/src/main/assets/apps/mapping/js/mapping-runtime-repair-v3.js": ["version: '5.0.0'", "markCachedSeriesUsable", "lastAnalyzedSignature"],
        "app/src/main/assets/apps/mapping/js/engine/structural-bias.js": ["classifySwingSequence", "existingMappingBias"],
        "app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js": ["SCALPER ENGINE · SHADOW MODE", "scalper-setups?limit=50", "displaySelectedSetupId"],
        "app/src/main/assets/apps/mapping/js/scalper-execution-authority.js": ["amyfx-preview-scalper-pattern-v3.0", "let applyQueued = false", "scheduleApply"],
        "app/src/main/assets/apps/mapping/index.html": ["live-price-display-only-v1.js", "scalper-execution-decision-bridge.js", "amyfx-theme-controller.js"],
    }
    for relative, expected in markers.items():
        content = read(target_root / relative)
        for marker in expected:
            if marker not in content:
                fail(f"{relative} missing parity marker: {marker}")

    forbidden = [
        "com.amyelitesuite.learningpreview",
        "amyfxpreview",
        "personal/amyfx-private/preview-update.json",
        "AmyFX-Preview-latest.apk",
        "preview-news-system-push",
    ]
    scan_roots = [
        target_root / "app/src/main",
        target_root / "api",
        target_root / "lib",
        target_root / "supabase/functions",
    ]
    for root in scan_roots:
        for file in text_files(root):
            content = read(file)
            for marker in forbidden:
                if marker in content:
                    fail(f"Preview identity leaked into {file.relative_to(target_root)}: {marker}")

    gradle = read(target_root / "app/build.gradle.kts")
    for marker in [
        '?: "com.amyelitesuite"',
        '?: "Amy FX"',
        '?: "amyfx"',
        f"?: {PRODUCTION_CODE})",
        f'?: "{PRODUCTION_VERSION}"',
    ]:
        if marker not in gradle:
            fail(f"production Gradle identity missing: {marker}")

    app_version = read(target_root / "app/src/main/assets/app-version.js")
    for marker in [
        f"name: '{PRODUCTION_VERSION}', code: {PRODUCTION_CODE}",
        "suhaimitoamy/Amy-fx/main/update.json",
    ]:
        if marker not in app_version:
            fail(f"production web identity missing: {marker}")


def main() -> None:
    if len(sys.argv) != 3:
        fail("usage: promote-preview-to-production.py <preview-root> <production-root>")
    source_root = Path(sys.argv[1]).resolve()
    target_root = Path(sys.argv[2]).resolve()

    copy_directories = [
        "app/src/main/assets/apps",
        "app/src/main/java/com/amyelitesuite",
        "supabase/functions/scalper-engine",
        "supabase/functions/scalper-setups",
        "supabase/functions/scalper-system-push",
        "supabase/functions/news-system-push",
        "supabase/functions/scheduled-news-sync",
    ]
    copy_files = [
        "app/src/main/assets/app.js",
        "app/src/main/assets/index.html",
        "app/src/main/assets/profile-system-settings-v1.js",
        "app/proguard-rules.pro",
        "api/heatmap.js",
        "api/liquidity.js",
        "api/twelvedata.js",
        "lib/market-candle-store.mjs",
        "supabase/functions/news-sync/handler.ts",
    ]
    parity_tests = [
        "tests/analysis-static-layout.test.mjs",
        "tests/closed-candle-aggregation.test.mjs",
        "tests/closed-candle-freshness-adapter.test.mjs",
        "tests/dashboard-only-panels-v1.test.mjs",
        "tests/execution-plan.test.mjs",
        "tests/honesty-audit-runtime.test.mjs",
        "tests/honesty-validated-series.test.mjs",
        "tests/mapping-accuracy-v3.test.mjs",
        "tests/mapping-analysis-list-stability-v2.test.mjs",
        "tests/mapping-bias-scalper-history-regression.test.mjs",
        "tests/mapping-bt71-market-state.test.mjs",
        "tests/mapping-dom-stability-v5.test.mjs",
        "tests/mapping-july-2026-clarity.test.mjs",
        "tests/mapping-live-consistency-regression.test.mjs",
        "tests/mapping-news-background-repair.test.mjs",
        "tests/mapping-session-replay.test.mjs",
        "tests/mapping-stable-outlook-blueprint.test.mjs",
        "tests/mapping-ui-simplification-v1.test.mjs",
        "tests/market-candle-store.test.mjs",
        "tests/market-single-api-freshness.test.mjs",
        "tests/market-state-contract.test.mjs",
        "tests/professional-glassmorphism-redesign.test.mjs",
        "tests/scalper-bt6-pattern-engine.test.mjs",
        "tests/scalper-direction-authority.test.mjs",
        "tests/scalper-engine-shadow-mode.test.mjs",
        "tests/scalper-multidriver.test.mjs",
        "tests/scalper-shadow-state.test.mjs",
        "tests/six-issues-regression.test.mjs",
    ]

    for relative in copy_directories + copy_files + parity_tests:
        copy_entry(source_root, target_root, relative)

    promoted_roots = [target_root / relative for relative in copy_directories + copy_files + parity_tests]
    sanitize_production_identity(promoted_roots)
    patch_production_versions(target_root)
    patch_release_workflow(target_root / ".github/workflows/build-apk.yml")
    patch_release_workflow(target_root / ".github/workflows/build-release.yml")

    source_sha = os.environ.get("AMYFX_PREVIEW_SOURCE_SHA", "unknown")
    metadata = {
        "source_repository": "suhaimitoamy/Amy-fx",
        "source_branch": "personal/amyfx-private",
        "source_commit": source_sha,
        "production_version": PRODUCTION_VERSION,
        "production_version_code": PRODUCTION_CODE,
        "strategy": "preview-runtime-parity-with-production-identity-preserved",
    }
    write(
        target_root / "docs/amyfx-production-preview-parity.json",
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
    )

    validate(target_root)
    print(
        f"Promoted Amy FX Preview runtime {source_sha[:12]} to Amy FX production "
        f"{PRODUCTION_VERSION} ({PRODUCTION_CODE}) while preserving production identity."
    )


if __name__ == "__main__":
    main()
