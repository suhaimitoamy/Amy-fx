#!/usr/bin/env python3
"""Idempotent stabilization installer for Amy FX Preview Blueprint v1."""
from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app/src/main/assets"
SHARED_CSS = ASSETS / "apps/shared/amyfx-blueprint-v1.css"
SHARED_JS = ASSETS / "apps/shared/amyfx-blueprint-v1.js"
HOTFIX_JS = ASSETS / "apps/shared/amyfx-blueprint-hotfix-v1.js"
MAIN_ACTIVITY = ROOT / "app/src/main/java/com/amyelitesuite/MainActivity.kt"
ACADEMY_INDEX = ASSETS / "apps/academy/index.html"
MODULE_HTML = [
    ASSETS / "index.html",
    ASSETS / "apps/mapping/index.html",
    ASSETS / "apps/market-intel/index.html",
    ASSETS / "apps/journal/index.html",
    ACADEMY_INDEX,
]
CSS_MARKER = "data-amyfx-blueprint-css"
JS_MARKER = "data-amyfx-blueprint-js"
HOTFIX_MARKER = "data-amyfx-blueprint-hotfix"


def relative_url(source: Path, target: Path) -> str:
    return Path(os.path.relpath(target, source.parent)).as_posix()


def replace_once(source: str, old: str, new: str, label: str) -> tuple[str, bool]:
    count = source.count(old)
    if count == 0:
        if new in source:
            return source, False
        raise RuntimeError(f"{label}: expected source pattern is missing")
    if count != 1:
        raise RuntimeError(f"{label}: expected one source pattern, found {count}")
    return source.replace(old, new, 1), True


def patch_blueprint_runtime() -> bool:
    raw = SHARED_JS.read_text(encoding="utf-8")
    updated = raw
    changed = False

    replacements = [
        (
            "    return nowIso();\n  }\n\n  function visibleText",
            "    return null;\n  }\n\n  function visibleText",
            "missing market timestamp must not become current time",
        ),
        (
            "    const capturedAt = resolveCapturedAt();\n    const timeframe = resolveTimeframe();",
            "    const capturedAt = resolveCapturedAt() || ([\"journal\", \"academy\"].includes(sourceModule) ? nowIso() : null);\n    const timeframe = resolveTimeframe();",
            "context capturedAt fallback",
        ),
        (
            "      display_time: Time.wita(capturedAt),",
            "      display_time: capturedAt ? Time.wita(capturedAt) : \"Belum ada data\",",
            "context display time",
        ),
        (
            "      lines.push(`Data terpilih: ${summary.total || 0} jurnal, win rate ${summary.winRate ?? \"belum cukup sampel\"}%.`);",
            "      lines.push(summary.winRate == null\n        ? `Data terpilih: ${summary.total || 0} jurnal, win rate belum cukup sampel.`\n        : `Data terpilih: ${summary.total || 0} jurnal, win rate ${summary.winRate}%.`);",
            "journal deterministic summary",
        ),
        (
            "    const target = document.querySelector(\"main, #app, .journal-shell\");",
            "    const target = document.querySelector(\"#journalView, [data-journal-view]\");",
            "Journal v2 target",
        ),
        (
            "      new MutationObserver(syncUi).observe(observerTarget, { childList: true, subtree: moduleName === \"home\" });",
            "      new MutationObserver(syncUi).observe(observerTarget, { childList: true, subtree: true });",
            "dynamic module observer",
        ),
    ]

    for old, new, label in replacements:
        updated, did_change = replace_once(updated, old, new, label)
        changed = changed or did_change

    if changed:
        SHARED_JS.write_text(updated, encoding="utf-8")
    return changed


def patch_academy_markup() -> bool:
    raw = ACADEMY_INDEX.read_text(encoding="utf-8")
    if 'href="bagian-15-menjadi-trader-mandiri/index.html">Buka Materi →</a></article></section>' in raw:
        return False
    pattern = re.compile(r'href="bagian-15-menjadi-trader-mandiri/index\s+<section', flags=re.I)
    replacement = 'href="bagian-15-menjadi-trader-mandiri/index.html">Buka Materi →</a></article></section>\n  <section'
    updated, count = pattern.subn(replacement, raw, count=1)
    if count != 1:
        raise RuntimeError("Academy Bagian 15 malformed boundary was not found")
    ACADEMY_INDEX.write_text(updated, encoding="utf-8")
    return True


def inject_html(path: Path) -> bool:
    if not path.is_file():
        raise RuntimeError(f"Required module page missing: {path}")
    raw = path.read_text(encoding="utf-8")
    updated = raw

    if CSS_MARKER not in updated:
        tag = f'  <link rel="stylesheet" href="{relative_url(path, SHARED_CSS)}" {CSS_MARKER}="v1">\n'
        if re.search(r"</head\s*>", updated, flags=re.I):
            updated = re.sub(r"</head\s*>", tag + "</head>", updated, count=1, flags=re.I)
        else:
            raise RuntimeError(f"Missing </head> in {path}")

    if JS_MARKER not in updated:
        tag = f'  <script src="{relative_url(path, SHARED_JS)}" {JS_MARKER}="v1"></script>\n'
        if re.search(r"</body\s*>", updated, flags=re.I):
            updated = re.sub(r"</body\s*>", tag + "</body>", updated, count=1, flags=re.I)
        else:
            raise RuntimeError(f"Missing </body> in {path}")

    if HOTFIX_MARKER not in updated:
        tag = f'  <script src="{relative_url(path, HOTFIX_JS)}" {HOTFIX_MARKER}="v1"></script>\n'
        if re.search(r"</body\s*>", updated, flags=re.I):
            updated = re.sub(r"</body\s*>", tag + "</body>", updated, count=1, flags=re.I)
        else:
            raise RuntimeError(f"Missing </body> in {path}")

    blueprint_index = updated.find(JS_MARKER)
    hotfix_index = updated.find(HOTFIX_MARKER)
    if blueprint_index < 0 or hotfix_index <= blueprint_index:
        raise RuntimeError(f"Blueprint stabilization order is invalid in {path}")

    if updated == raw:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def patch_main_activity() -> bool:
    if not MAIN_ACTIVITY.is_file():
        raise RuntimeError(f"Missing MainActivity: {MAIN_ACTIVITY}")
    raw = MAIN_ACTIVITY.read_text(encoding="utf-8")
    bridge = 'webView.addJavascriptInterface(AmyFxAiBridge(this, webView), "AmyNativeAI")'
    if bridge in raw:
        return False
    anchor = 'webView.addJavascriptInterface(WebAppInterface(this), "Android")'
    position = raw.find(anchor)
    if position < 0:
        raise RuntimeError("MainActivity Android bridge anchor missing")
    line_start = raw.rfind("\n", 0, position) + 1
    indent = raw[line_start:position]
    line_end = raw.find("\n", position)
    if line_end < 0:
        line_end = len(raw)
    insertion = "\n" + indent + bridge
    MAIN_ACTIVITY.write_text(raw[:line_end] + insertion + raw[line_end:], encoding="utf-8")
    return True


def main() -> None:
    changed: list[str] = []
    for required in (SHARED_CSS, SHARED_JS, HOTFIX_JS):
        if not required.is_file():
            raise SystemExit(f"Required Blueprint asset missing: {required}")

    if patch_blueprint_runtime():
        changed.append(SHARED_JS.relative_to(ROOT).as_posix())
    if patch_academy_markup():
        changed.append(ACADEMY_INDEX.relative_to(ROOT).as_posix())

    for html in MODULE_HTML:
        if inject_html(html):
            changed.append(html.relative_to(ROOT).as_posix())

    if patch_main_activity():
        changed.append(MAIN_ACTIVITY.relative_to(ROOT).as_posix())

    print(f"Amy FX Preview stabilization installed; changed={len(changed)}")
    for item in changed:
        print(item)


if __name__ == "__main__":
    main()
