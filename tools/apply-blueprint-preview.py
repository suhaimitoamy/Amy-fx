#!/usr/bin/env python3
"""Best-effort, idempotent Blueprint installer for Amy FX Preview."""
from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app/src/main/assets"
SHARED_CSS = ASSETS / "apps/shared/amyfx-blueprint-v1.css"
SHARED_JS = ASSETS / "apps/shared/amyfx-blueprint-v1.js"
MAIN_ACTIVITY = ROOT / "app/src/main/java/com/amyelitesuite/MainActivity.kt"
MODULE_HTML = [
    ASSETS / "index.html",
    ASSETS / "apps/mapping/index.html",
    ASSETS / "apps/market-intel/index.html",
    ASSETS / "apps/journal/index.html",
    ASSETS / "apps/academy/index.html",
]
CSS_MARKER = "data-amyfx-blueprint-css"
JS_MARKER = "data-amyfx-blueprint-js"


def relative_url(source: Path, target: Path) -> str:
    return Path(os.path.relpath(target, source.parent)).as_posix()


def inject_html(path: Path) -> bool:
    if not path.is_file():
        print(f"SKIP missing page: {path}")
        return False
    try:
        raw = path.read_text(encoding="utf-8")
    except Exception as error:
        print(f"SKIP unreadable page: {path}: {error}")
        return False
    updated = raw
    if CSS_MARKER not in updated:
        tag = f'  <link rel="stylesheet" href="{relative_url(path, SHARED_CSS)}" {CSS_MARKER}="v1">\n'
        if re.search(r"</head\s*>", updated, flags=re.I):
            updated = re.sub(r"</head\s*>", tag + "</head>", updated, count=1, flags=re.I)
        else:
            updated = tag + updated
    if JS_MARKER not in updated:
        tag = f'  <script src="{relative_url(path, SHARED_JS)}" {JS_MARKER}="v1"></script>\n'
        if re.search(r"</body\s*>", updated, flags=re.I):
            updated = re.sub(r"</body\s*>", tag + "</body>", updated, count=1, flags=re.I)
        else:
            updated += "\n" + tag
    if updated == raw:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def patch_main_activity() -> bool:
    if not MAIN_ACTIVITY.is_file():
        print(f"SKIP missing MainActivity: {MAIN_ACTIVITY}")
        return False
    raw = MAIN_ACTIVITY.read_text(encoding="utf-8")
    bridge = 'webView.addJavascriptInterface(AmyFxAiBridge(this, webView), "AmyNativeAI")'
    if bridge in raw:
        return False
    anchor = 'webView.addJavascriptInterface(WebAppInterface(this), "Android")'
    position = raw.find(anchor)
    if position < 0:
        print("SKIP MainActivity bridge anchor missing")
        return False
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
    if not SHARED_CSS.is_file() or not SHARED_JS.is_file():
        print("SKIP Blueprint shared runtime files are missing")
        return
    for html in MODULE_HTML:
        try:
            if inject_html(html):
                changed.append(html.relative_to(ROOT).as_posix())
        except Exception as error:
            print(f"SKIP failed page {html}: {error}")
    try:
        if patch_main_activity():
            changed.append(MAIN_ACTIVITY.relative_to(ROOT).as_posix())
    except Exception as error:
        print(f"SKIP MainActivity patch failed: {error}")
    print(f"Amy FX Preview blueprint installer completed; changed={len(changed)}")
    for item in changed:
        print(item)


if __name__ == "__main__":
    main()
