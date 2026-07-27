#!/usr/bin/env python3
"""Idempotent stabilization installer for Amy FX Preview Blueprint v1."""
from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app/src/main/assets"
APP_VERSION = ASSETS / "app-version.js"
UPDATE_CHECKER = ASSETS / "update-checker.js"
SHARED_CSS = ASSETS / "apps/shared/amyfx-blueprint-v1.css"
SHARED_JS = ASSETS / "apps/shared/amyfx-blueprint-v1.js"
HOTFIX_JS = ASSETS / "apps/shared/amyfx-blueprint-hotfix-v1.js"
PROVIDER_FIX_JS = ASSETS / "apps/shared/amyfx-provider-detection-v1.js"
HOME_DATA_JS = ASSETS / "apps/shared/amyfx-home-data-integration-v1.js"
MAPPING_BRIDGE_JS = ASSETS / "apps/mapping/js/blueprint-context-bridge.js"
MAPPING_INDEX = ASSETS / "apps/mapping/index.html"
MARKET_INTEL_INDEX = ASSETS / "apps/market-intel/index.html"
JOURNAL_APP = ASSETS / "apps/journal/app.js"
MARKET_INTEL_SHARED = ASSETS / "apps/shared/market-intelligence.js"
MARKET_INTEL_APP = ASSETS / "apps/market-intel/app.js"
HEATMAP_V2 = ASSETS / "apps/market-intel/heatmap-v2.js"
MAIN_ACTIVITY = ROOT / "app/src/main/java/com/amyelitesuite/MainActivity.kt"
PROVIDER_REPAIR_BRIDGE = ROOT / "app/src/main/java/com/amyelitesuite/AmyFxAiProviderRepairBridge.kt"
ACADEMY_INDEX = ASSETS / "apps/academy/index.html"
MODULE_HTML = [
    ASSETS / "index.html",
    MAPPING_INDEX,
    MARKET_INTEL_INDEX,
    ASSETS / "apps/journal/index.html",
    ACADEMY_INDEX,
]
CSS_MARKER = "data-amyfx-blueprint-css"
JS_MARKER = "data-amyfx-blueprint-js"
HOTFIX_MARKER = "data-amyfx-blueprint-hotfix"
PROVIDER_FIX_MARKER = "data-amyfx-provider-detection"


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


def normalize_source_identity() -> list[Path]:
    """Keep the branch on production source identity; stamp Preview only inside CI build."""
    changed: list[Path] = []

    app_raw = APP_VERSION.read_text(encoding="utf-8")
    app_updated = re.sub(
        r"const VERSION = Object\.freeze\(\{ name: '[^']+', code: \d+ \}\);",
        "const VERSION = Object.freeze({ name: '1.5.9', code: 50 });",
        app_raw,
        count=1,
    )
    app_updated = re.sub(
        r"^\s*window\.AmyFXUpdateManifestUrl\s*=.*;\s*\n?",
        "",
        app_updated,
        count=1,
        flags=re.M,
    )
    if app_updated != app_raw:
        APP_VERSION.write_text(app_updated, encoding="utf-8")
        changed.append(APP_VERSION)

    checker_raw = UPDATE_CHECKER.read_text(encoding="utf-8")
    checker_updated = checker_raw
    replacements = [
        (
            r"const VERSION = window\.AmyFXAppVersion \|\| \{ name: '[^']+', code: \d+ \};",
            "const VERSION = window.AmyFXAppVersion || { name: '1.4.11', code: 34 };",
        ),
        (
            r"const CURRENT_VERSION_CODE = Number\(VERSION\.code\) \|\| \d+;",
            "const CURRENT_VERSION_CODE = Number(VERSION.code) || 34;",
        ),
        (
            r"const CURRENT_VERSION_NAME = String\(VERSION\.name \|\| '[^']+'\);",
            "const CURRENT_VERSION_NAME = String(VERSION.name || '1.4.11');",
        ),
        (
            r"const UPDATE_URL = (?:window\.AmyFXUpdateManifestUrl\s*\n\s*\|\|\s*)?'[^']+';",
            "const UPDATE_URL = 'https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/main/update.json';",
        ),
    ]
    for pattern, replacement in replacements:
        checker_updated, count = re.subn(pattern, replacement, checker_updated, count=1)
        if count != 1:
            raise RuntimeError(f"Updater source identity pattern missing: {pattern}")

    checker_updated = re.sub(
        r"\n  function announceNativeUpdate\(latestCode, latestName\) \{.*?\n  \}\n\n(?=  function showUpdatePopup)",
        "\n",
        checker_updated,
        count=1,
        flags=re.S,
    )
    checker_updated = checker_updated.replace("          announceNativeUpdate(latestCode, latestName);\n", "", 1)
    if checker_updated != checker_raw:
        UPDATE_CHECKER.write_text(checker_updated, encoding="utf-8")
        changed.append(UPDATE_CHECKER)

    return changed


def patch_blueprint_runtime() -> bool:
    raw = SHARED_JS.read_text(encoding="utf-8")
    updated = raw

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
        (
            "  function journalRows() {\n    if (Array.isArray(window.state?.journals)) return clone(window.state.journals);\n    const value = readJsonStorage(CONFIG.legacyJournalKey, []);\n    return Array.isArray(value) ? value : [];\n  }",
            "  function journalRows() {\n    const bridge = window.AmyFXJournalState;\n    if (typeof bridge?.getJournals === \"function\") {\n      const rows = bridge.getJournals();\n      if (Array.isArray(rows)) return clone(rows);\n    }\n    if (Array.isArray(bridge?.journals)) return clone(bridge.journals);\n    const value = readJsonStorage(CONFIG.legacyJournalKey, []);\n    return Array.isArray(value) ? value : [];\n  }",
            "authoritative Journal bridge",
        ),
        (
            "  function journalPayload() {\n    return {\n      summary: journalSummary(),\n      selected_entry_id: window.state?.selectedJournalId || null,\n      selected_entry: clone(window.state?.selectedJournal || null),\n      visible_summary: visibleText(\"main, #app, .journal-shell\", 1000)\n    };\n  }",
            "  function journalPayload() {\n    const bridge = window.AmyFXJournalState || {};\n    const selectedId = bridge.selectedJournalId || null;\n    const selected = bridge.selectedJournal\n      || journalRows().find(row => String(row?.id || \"\") === String(selectedId || \"\"))\n      || null;\n    return {\n      summary: journalSummary(),\n      selected_entry_id: selectedId,\n      selected_entry: clone(selected),\n      visible_summary: visibleText(\"main, #app, .journal-shell\", 1000)\n    };\n  }",
            "Journal selected-entry bridge",
        ),
        (
            "  function intelPayload() {\n    return {\n      pair: resolvePair(),\n      scheduled_event: clone(window.AmyFXIntel?.scheduledEvent || null),\n      published_news: clone(window.AmyFXIntel?.selectedNews || null),\n      heatmap: clone(window.AmyFXHeatmapState || null),\n      source_method: window.AmyFXHeatmapState?.sourceMethod || \"OHLC-derived/modelled liquidity\",\n      visible_summary: visibleText(\"main, #app, .intel-container\", 1000)\n    };\n  }",
            "  function intelPayload() {\n    const shared = window.AmyFXIntel?.read?.() || window.AmyFXIntelState || {};\n    const heatmap = window.AmyFXHeatmapState || shared.heatmap || null;\n    const news = shared.news || null;\n    return {\n      pair: resolvePair(),\n      scheduled_event: clone(window.AmyFXIntel?.scheduledEvent || null),\n      published_news: clone(window.AmyFXIntel?.selectedNews || news?.items?.[0] || null),\n      news_items: clone(news?.items || []),\n      heatmap: clone(heatmap),\n      liquidity: clone(shared.liquidity || null),\n      source_method: heatmap?.sourceMethod || heatmap?.source || \"OHLC-derived/modelled liquidity\",\n      visible_summary: visibleText(\"main, #app, .intel-container\", 1000)\n    };\n  }",
            "Market Intel shared-state bridge",
        ),
    ]

    for old, new, label in replacements:
        updated, _ = replace_once(updated, old, new, label)

    old_values = """      window.AmyFXHeatmapState?.updatedAt,
      window.AmyFXIntel?.updatedAt
    ];"""
    new_values = """      window.AmyFXHeatmapState?.updatedAt,
      window.AmyFXIntelState?.updatedAt,
      window.AmyFXIntel?.read?.()?.mapping?.updated,
      window.AmyFXIntel?.read?.()?.heatmap?.updated,
      window.AmyFXIntel?.read?.()?.liquidity?.updated,
      window.AmyFXIntel?.read?.()?.news?.updated
    ];"""
    updated, _ = replace_once(updated, old_values, new_values, "shared market timestamps")

    listener_anchor = """    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshMentorContext();
    });"""
    listener_block = """    ["amyfx:journal-state-change", "amyfx:mapping-state-change", "amyfx:market-update", "amyfx:home-stats-change"]
      .forEach(name => window.addEventListener(name, () => refreshMentorContext()));"""
    if listener_anchor not in updated:
        raise RuntimeError("live context refresh visibility anchor is missing")
    while listener_block in updated:
        updated = updated.replace(listener_block + "\n", "", 1)
    updated = updated.replace(listener_anchor, listener_block + "\n" + listener_anchor, 1)

    changed = updated != raw
    if changed:
        SHARED_JS.write_text(updated, encoding="utf-8")
    return changed


def patch_journal_runtime() -> bool:
    raw = JOURNAL_APP.read_text(encoding="utf-8")
    updated = raw
    changed = False
    marker = "window.AmyFXJournalState"

    if marker not in updated:
        anchor = "async function boot() {"
        bridge = r'''function publishAmyFxJournalState() {
  const journals = Array.isArray(state.journals) ? state.journals : [];
  const selectedJournalId = state.journalOpenId || "";
  const selectedJournal = journals.find(row => String(row?.id || "") === String(selectedJournalId)) || null;
  window.AmyFXJournalState = {
    getJournals: () => state.journals,
    journals,
    selectedJournalId: selectedJournalId || null,
    selectedJournal,
    view: state.view,
    updatedAt: new Date().toISOString()
  };
  window.dispatchEvent(new CustomEvent("amyfx:journal-state-change", { detail: window.AmyFXJournalState }));
  return window.AmyFXJournalState;
}

'''
        if anchor not in updated:
            raise RuntimeError("Journal boot anchor missing")
        updated = updated.replace(anchor, bridge + anchor, 1)
        changed = True

    old_render = """function render() {
  revokeRenderedObjectUrls();
  const data = getRenderData();
  updateRenderCounters(data);
  renderActiveView(data);
  syncSelectControls();
}"""
    new_render = """function render() {
  revokeRenderedObjectUrls();
  const data = getRenderData();
  updateRenderCounters(data);
  renderActiveView(data);
  syncSelectControls();
  publishAmyFxJournalState();
}"""
    updated, did_change = replace_once(updated, old_render, new_render, "Journal state publication after render")
    changed = changed or did_change

    if changed:
        JOURNAL_APP.write_text(updated, encoding="utf-8")
    return changed


def patch_market_intel_runtime() -> list[Path]:
    changed: list[Path] = []

    shared_raw = MARKET_INTEL_SHARED.read_text(encoding="utf-8")
    shared_updated = shared_raw.replace("timeZone: 'Asia/Jakarta'", "timeZone: 'Asia/Makassar'")
    canonical_contract = "__amyCanonicalMarketContractV2" in shared_updated or "AmyFXMarketContract" in shared_updated
    if not canonical_contract:
        write_old = """    state[part] = { ...payload, storedAt: Date.now() };
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('amyfx:market-update', { detail: state }));"""
        write_new = """    state[part] = { ...payload, storedAt: Date.now() };
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    window.AmyFXIntelState = { ...state, updatedAt: payload?.updated || new Date().toISOString() };
    if (part === 'heatmap') window.AmyFXHeatmapState = { ...state[part], sourceMethod: payload?.source || payload?.sourceMethod || 'OHLC-derived/modelled liquidity' };
    window.dispatchEvent(new CustomEvent('amyfx:market-update', { detail: state }));"""
        shared_updated, _ = replace_once(shared_updated, write_old, write_new, "Market Intel global contract")
    if shared_updated != shared_raw:
        MARKET_INTEL_SHARED.write_text(shared_updated, encoding="utf-8")
        changed.append(MARKET_INTEL_SHARED)

    intel_raw = MARKET_INTEL_APP.read_text(encoding="utf-8")
    intel_updated = intel_raw.replace("timeZone: 'Asia/Jakarta' }) + ' WIB'", "timeZone: 'Asia/Makassar' }) + ' WITA'")
    if intel_updated != intel_raw:
        MARKET_INTEL_APP.write_text(intel_updated, encoding="utf-8")
        changed.append(MARKET_INTEL_APP)

    heat_raw = HEATMAP_V2.read_text(encoding="utf-8")
    heat_updated = heat_raw.replace("timeZone: 'Asia/Jakarta', hour:", "timeZone: 'Asia/Makassar', hour:")
    heat_updated = heat_updated.replace("}).format(parsed)} WIB`", "}).format(parsed)} WITA`")
    if heat_updated != heat_raw:
        HEATMAP_V2.write_text(heat_updated, encoding="utf-8")
        changed.append(HEATMAP_V2)

    return changed


def validate_mapping_document() -> None:
    raw = MAPPING_INDEX.read_text(encoding="utf-8")
    first = raw.lstrip("\ufeff\n\r\t ")
    if not first.lower().startswith("<!doctype html>"):
        raise RuntimeError("Mapping document must start with <!doctype html>")
    head_close = raw.lower().find("</head>")
    body_open = raw.lower().find("<body")
    if head_close < 0 or body_open < 0 or head_close > body_open:
        raise RuntimeError("Mapping document has an invalid head/body boundary")


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

    if PROVIDER_FIX_MARKER not in updated:
        tag = f'  <script src="{relative_url(path, PROVIDER_FIX_JS)}" {PROVIDER_FIX_MARKER}="v1"></script>\n'
        if re.search(r"</body\s*>", updated, flags=re.I):
            updated = re.sub(r"</body\s*>", tag + "</body>", updated, count=1, flags=re.I)
        else:
            raise RuntimeError(f"Missing </body> in {path}")

    blueprint_index = updated.find(JS_MARKER)
    hotfix_index = updated.find(HOTFIX_MARKER)
    provider_fix_index = updated.find(PROVIDER_FIX_MARKER)
    market_page = path in {MAPPING_INDEX, MARKET_INTEL_INDEX}
    valid_order = (
        hotfix_index >= 0
        and blueprint_index >= 0
        and provider_fix_index >= 0
        and (
            hotfix_index < blueprint_index < provider_fix_index
            if market_page
            else blueprint_index < hotfix_index < provider_fix_index
        )
    )
    if not valid_order:
        raise RuntimeError(f"Blueprint stabilization order is invalid in {path}")

    if updated == raw:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def patch_main_activity() -> bool:
    if not MAIN_ACTIVITY.is_file():
        raise RuntimeError(f"Missing MainActivity: {MAIN_ACTIVITY}")
    raw = MAIN_ACTIVITY.read_text(encoding="utf-8")
    lines = raw.splitlines()
    anchor = 'webView.addJavascriptInterface(WebAppInterface(this), "Android")'
    anchor_index = next((index for index, line in enumerate(lines) if anchor in line), -1)
    if anchor_index < 0:
        raise RuntimeError("MainActivity Android bridge anchor missing")

    indent = lines[anchor_index][: len(lines[anchor_index]) - len(lines[anchor_index].lstrip())]
    bridges = [
        'webView.addJavascriptInterface(AmyFxAiBridge(this, webView), "AmyNativeAI")',
        'webView.addJavascriptInterface(AmyFxAiProviderRepairBridge(this), "AmyNativeAIRepair")',
    ]
    insertion_index = anchor_index + 1
    changed = False
    for bridge in bridges:
        if bridge in raw:
            continue
        lines.insert(insertion_index, indent + bridge)
        insertion_index += 1
        changed = True

    if changed:
        MAIN_ACTIVITY.write_text("\n".join(lines) + ("\n" if raw.endswith("\n") else ""), encoding="utf-8")
    return changed


def main() -> None:
    changed: list[str] = []
    required_files = (
        APP_VERSION,
        UPDATE_CHECKER,
        SHARED_CSS,
        SHARED_JS,
        HOTFIX_JS,
        PROVIDER_FIX_JS,
        HOME_DATA_JS,
        MAPPING_BRIDGE_JS,
        JOURNAL_APP,
        MARKET_INTEL_SHARED,
        MARKET_INTEL_APP,
        HEATMAP_V2,
        PROVIDER_REPAIR_BRIDGE,
    )
    for required in required_files:
        if not required.is_file():
            raise SystemExit(f"Required Blueprint asset missing: {required}")

    validate_mapping_document()
    for path in normalize_source_identity():
        changed.append(path.relative_to(ROOT).as_posix())
    if patch_blueprint_runtime():
        changed.append(SHARED_JS.relative_to(ROOT).as_posix())
    if patch_journal_runtime():
        changed.append(JOURNAL_APP.relative_to(ROOT).as_posix())
    for path in patch_market_intel_runtime():
        changed.append(path.relative_to(ROOT).as_posix())
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
