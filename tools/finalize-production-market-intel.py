#!/usr/bin/env python3
"""Keep Preview Market Intelligence UI while routing production through public gateways."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "app/src/main/assets/apps/market-intel/index.html"
PRIVATE_ROUTER = ROOT / "app/src/main/assets/apps/market-intel/private-market-api-router.js"

html = INDEX.read_text(encoding="utf-8")
html = html.replace('  <script src="private-market-api-router.js"></script>\n', '')
html = html.replace('<script src="private-market-api-router.js"></script>\n', '')
INDEX.write_text(html, encoding="utf-8")

if PRIVATE_ROUTER.exists():
    PRIVATE_ROUTER.unlink()

if "private-market-api-router.js" in INDEX.read_text(encoding="utf-8"):
    raise SystemExit("[production-market-intel] private router remains in Market Intel index")

print("Amy FX production Market Intelligence uses public production gateways with Preview UI preserved.")
