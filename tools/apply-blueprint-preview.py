#!/usr/bin/env python3
"""Idempotently install the Amy FX Preview blueprint runtime into user modules."""
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
REQUIRED_HTML = {
    ASSETS / "index.html",
    ASSETS / "apps/mapping/index.html",
    ASSETS / "apps/market-intel/index.html",
    ASSETS / "apps/journal/index.html",
    ASSETS / "apps/academy/index.html",
}


def relative_url(source: Path, target: Path) -> str:
    return Path(os.path.relpath(target, source.parent)).as_posix()


def inject_html(path: Path) -> tuple[bool, str | None]:
    try:
        raw = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        if path in REQUIRED_HTML:
            raise
        return False, "non-utf8"
    has_head = bool(re.search(r"</head\s*>", raw, flags=re.I))
    has_body = bool(re.search(r"</body\s*>", raw, flags=re.I))
    if not has_head or not has_body:
        if path in REQUIRED_HTML:
            raise RuntimeError(f"Required page lacks complete HTML shell: {path}")
        return False, "fragment"

    updated = raw
    if CSS_MARKER not in updated:
        css_url = relative_url(path, SHARED_CSS)
        tag = f'  <link rel="stylesheet" href="{css_url}" {CSS_MARKER}="v1">\n'
        updated = re.sub(r"</head\s*>", tag + "</head>", updated, count=1, flags=re.I)
    if JS_MARKER not in updated:
        js_url = relative_url(path, SHARED_JS)
        tag = f'  <script src="{js_url}" {JS_MARKER}="v1"></script>\n'
        updated = re.sub(r"</body\s*>", tag + "</body>", updated, count=1, flags=re.I)
    if updated != raw:
        path.write_text(updated, encoding="utf-8")
        return True, None
    return False, None


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
    missing = [path for path in REQUIRED_HTML if not path.is_file()]
    if missing:
        raise SystemExit("Required module pages missing: " + ", ".join(str(path) for path in missing))
    changed: list[str] = []
    skipped: list[str] = []
    for html in candidate_html():
        did_change, reason = inject_html(html)
        relative = html.relative_to(ROOT).as_posix()
        if did_change:
            changed.append(relative)
        elif reason:
            skipped.append(f"{relative}:{reason}")
    if patch_main_activity():
        changed.append(MAIN_ACTIVITY.relative_to(ROOT).as_posix())
    print(f"Amy FX Preview blueprint installed; changed={len(changed)} skipped={len(skipped)}")
    for item in changed:
        print(item)
    for item in skipped:
        print(f"SKIP {item}")


if __name__ == "__main__":
    main()
