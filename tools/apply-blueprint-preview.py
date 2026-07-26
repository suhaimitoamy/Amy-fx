#!/usr/bin/env python3
"""Idempotently install the Amy FX Preview blueprint runtime into all user modules."""
from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app/src/main/assets"
SHARED_CSS = ASSETS / "apps/shared/amyfx-blueprint-v1.css"
SHARED_JS = ASSETS / "apps/shared/amyfx-blueprint-v1.js"
MAIN_ACTIVITY = ROOT / "app/src/main/java/com/amyelitesuite/MainActivity.kt"

CSS_MARKER = "data-amyfx-blueprint-css"
JS_MARKER = "data-amyfx-blueprint-js"


def relative_url(source: Path, target: Path) -> str:
    return Path(os.path.relpath(target, source.parent)).as_posix()


def inject_html(path: Path) -> bool:
    raw = path.read_text(encoding="utf-8")
    updated = raw
    if CSS_MARKER not in updated:
        css_url = relative_url(path, SHARED_CSS)
        tag = f'  <link rel="stylesheet" href="{css_url}" {CSS_MARKER}="v1">\n'
        if re.search(r"</head\s*>", updated, flags=re.I):
            updated = re.sub(r"</head\s*>", tag + "</head>", updated, count=1, flags=re.I)
        else:
            raise RuntimeError(f"Missing </head> in {path}")
    if JS_MARKER not in updated:
        js_url = relative_url(path, SHARED_JS)
        tag = f'  <script src="{js_url}" {JS_MARKER}="v1"></script>\n'
        if re.search(r"</body\s*>", updated, flags=re.I):
            updated = re.sub(r"</body\s*>", tag + "</body>", updated, count=1, flags=re.I)
        else:
            raise RuntimeError(f"Missing </body> in {path}")
    if updated != raw:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


def patch_main_activity() -> bool:
    raw = MAIN_ACTIVITY.read_text(encoding="utf-8")
    if 'addJavascriptInterface(AmyFxAiBridge(this, webView), "AmyNativeAI")' in raw:
        return False
    anchor = '        webView.addJavascriptInterface(WebAppInterface(this), "Android")\n'
    if raw.count(anchor) != 1:
        raise RuntimeError("MainActivity Android bridge anchor missing or ambiguous")
    replacement = anchor + '        webView.addJavascriptInterface(AmyFxAiBridge(this, webView), "AmyNativeAI")\n'
    MAIN_ACTIVITY.write_text(raw.replace(anchor, replacement, 1), encoding="utf-8")
    return True


def candidate_html() -> list[Path]:
    paths = [ASSETS / "index.html"]
    for module in ("mapping", "market-intel", "journal", "academy"):
        root = ASSETS / "apps" / module
        if root.exists():
            paths.extend(sorted(root.rglob("*.html")))
    return sorted(set(paths))


def main() -> None:
    if not SHARED_CSS.is_file() or not SHARED_JS.is_file():
        raise SystemExit("Blueprint shared runtime files are missing")
    changed = []
    for html in candidate_html():
        if inject_html(html):
            changed.append(html.relative_to(ROOT).as_posix())
    if patch_main_activity():
        changed.append(MAIN_ACTIVITY.relative_to(ROOT).as_posix())
    print(f"Amy FX Preview blueprint installed; changed={len(changed)}")
    for item in changed:
        print(item)


if __name__ == "__main__":
    main()
