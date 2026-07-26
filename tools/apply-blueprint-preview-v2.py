#!/usr/bin/env python3
"""Run the Blueprint installer with an idempotent Market Intelligence adapter."""
from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY_INSTALLER = Path(__file__).with_name("apply-blueprint-preview.py")


def load_installer():
    spec = importlib.util.spec_from_file_location("amyfx_blueprint_installer", LEGACY_INSTALLER)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load Blueprint installer")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def install() -> None:
    installer = load_installer()

    def patch_market_intel_runtime() -> list[Path]:
        changed: list[Path] = []

        shared_raw = installer.MARKET_INTEL_SHARED.read_text(encoding="utf-8")
        shared_updated = shared_raw.replace("timeZone: 'Asia/Jakarta'", "timeZone: 'Asia/Makassar'")

        legacy = """    state[part] = { ...payload, storedAt: Date.now() };
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('amyfx:market-update', { detail: state }));"""
        legacy_replacement = """    state[part] = { ...payload, storedAt: Date.now() };
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    window.AmyFXIntelState = { ...state, updatedAt: payload?.updated || new Date().toISOString() };
    if (part === 'heatmap') window.AmyFXHeatmapState = { ...state[part], sourceMethod: payload?.source || payload?.sourceMethod || 'OHLC-derived/modelled liquidity' };
    window.dispatchEvent(new CustomEvent('amyfx:market-update', { detail: state }));"""

        if legacy in shared_updated:
            shared_updated = shared_updated.replace(legacy, legacy_replacement, 1)

        required_contracts = (
            "window.AmyFXIntelState",
            "window.AmyFXHeatmapState",
            "amyfx:market-update",
            "function freshness",
            "function bestCurrentPrice",
        )
        missing = [marker for marker in required_contracts if marker not in shared_updated]
        if missing:
            raise RuntimeError(f"Market Intelligence contract missing: {', '.join(missing)}")

        if shared_updated != shared_raw:
            installer.MARKET_INTEL_SHARED.write_text(shared_updated, encoding="utf-8")
            changed.append(installer.MARKET_INTEL_SHARED)

        intel_raw = installer.MARKET_INTEL_APP.read_text(encoding="utf-8")
        intel_updated = intel_raw.replace("timeZone: 'Asia/Jakarta' }) + ' WIB'", "timeZone: 'Asia/Makassar' }) + ' WITA'")
        if intel_updated != intel_raw:
            installer.MARKET_INTEL_APP.write_text(intel_updated, encoding="utf-8")
            changed.append(installer.MARKET_INTEL_APP)

        heat_raw = installer.HEATMAP_V2.read_text(encoding="utf-8")
        heat_updated = heat_raw.replace("timeZone: 'Asia/Jakarta', hour:", "timeZone: 'Asia/Makassar', hour:")
        heat_updated = heat_updated.replace("}).format(parsed)} WIB`", "}).format(parsed)} WITA`")
        if heat_updated != heat_raw:
            installer.HEATMAP_V2.write_text(heat_updated, encoding="utf-8")
            changed.append(installer.HEATMAP_V2)

        return changed

    installer.patch_market_intel_runtime = patch_market_intel_runtime
    installer.main()


if __name__ == "__main__":
    install()
