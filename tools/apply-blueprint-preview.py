#!/usr/bin/env python3
"""Idempotently install the Amy FX Preview blueprint runtime into principal modules."""
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
        raise RuntimeError(f"Required module page missing: {path}")
    raw = path.read_text(encoding="utf-8")
    if not re.search(r"</head\s*>", raw, flags=re.I) or not re.search(r"</body\s*>", raw, flags=re.I):
        raise RuntimeError(f"Required module page lacks complete HTML shell: {path}")
    updated = raw
    if CSS_MARKER not in updated:
        tag = f'  <link rel="stylesheet" href="{relative_url(path, SHARED_CSS)}" {CSS_MARKER}="v1">\n'
        updated = re.sub(r"</head\s*>", tag + "</head>", updated, count=1, flags=re.I)
    if JS_MARKER not in updated:
        tag = f'  <script src="{relative_url(path, SHARED_JS)}" {JS_MARKER}="v1"></script>\n'
        updated = re.sub(r"</body\s*>", tag + "</body>", updated, count=1, flags=re.I)
    if updated == raw:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def patch_main_activity() -> bool:
    raw = MAIN_ACTIVITY.read_text(encoding="utf-8")
    bridge = 'webView.addJavascriptInterface(AmyFxAiBridge(this, webView), "AmyNativeAI")'
    if bridge in raw:
        return False
    pattern = r'(?m)^(\s*)webView\.addJavascriptInterface\(WebAppInterface\(this\), "Android"\)\s*$'
    match = re.search(pattern, raw)
    if not match:
        raise RuntimeError("MainActivity Android bridge anchor missing")
    replacement = match.group(0) + "\n" + match.group(1) + bridge
    MAIN_ACTIVITY.write_text(raw[:match.start()] + replacement + raw[match.end():], encoding="utf-8")
    return True


def main() -> None:
    if not SHARED_CSS.is_file() or not SHARED_JS.is_file():
        raise SystemExit("Blueprint shared runtime files are missing")
    changed: list[str] = []
    for html in MODULE_HTML:
        if inject_html(html):
            changed.append(html.relative_to(ROOT).as_posix())
    if patch_main_activity():
        changed.append(MAIN_ACTIVITY.relative_to(ROOT).as_posix())
    print(f"Amy FX Preview blueprint installed; changed={len(changed)}")
    for item in changed:
        print(item)


if __name__ == "__main__":
    main()
