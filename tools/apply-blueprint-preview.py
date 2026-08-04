#!/usr/bin/env python3
"""Run Blueprint stabilization without replacing the private Preview version identity."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

CORE_INSTALLER = Path(__file__).with_name("apply-blueprint-preview-core.py")
ROOT = Path(__file__).resolve().parents[1]
PREVIEW_MANIFEST = ROOT / "preview-update.json"
PRIVATE_MANIFEST_URL = (
    "https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/"
    "personal/amyfx-private/preview-update.json"
)


def load_installer():
    spec = importlib.util.spec_from_file_location("amyfx_blueprint_core", CORE_INSTALLER)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load Blueprint stabilization core")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def parse_preview_identity(source: str, label: str) -> tuple[str, int, int]:
    match = re.search(
        r"name:\s*'(2\.0\.0-preview\.(\d+))'\s*,\s*code:\s*(94\d{4})",
        source,
    )
    if match is None:
        raise RuntimeError(f"{label} Preview version identity is missing or invalid")
    version_name, sequence_text, version_code_text = match.groups()
    sequence = int(sequence_text)
    version_code = int(version_code_text)
    if version_code != 940000 + sequence:
        raise RuntimeError(f"{label} Preview version code does not match its suffix")
    return version_name, sequence, version_code


def align_updater_fallback(source: str, version_name: str, version_code: int) -> str:
    """Keep the reviewed updater fallback aligned with the pending Preview source."""
    aligned = re.sub(
        r"window\.AmyFXAppVersion\s*\|\|\s*\{\s*name:\s*'2\.0\.0-preview\.\d+'\s*,\s*code:\s*94\d{4}\s*\}",
        f"window.AmyFXAppVersion || {{ name: '{version_name}', code: {version_code} }}",
        source,
        count=1,
    )
    aligned = re.sub(
        r"(const CURRENT_VERSION_CODE = Number\(VERSION\.code\) \|\| )94\d{4}",
        rf"\g<1>{version_code}",
        aligned,
        count=1,
    )
    aligned = re.sub(
        r"(const CURRENT_VERSION_NAME = String\(VERSION\.name \|\| )'2\.0\.0-preview\.\d+'(\);)",
        rf"\g<1>'{version_name}'\g<2>",
        aligned,
        count=1,
    )
    return aligned


def preserve_private_preview_identity(installer) -> list[Path]:
    """Validate private Preview identity and align its deterministic updater fallback."""
    app_version = installer.APP_VERSION.read_text(encoding="utf-8")
    source_name, source_sequence, source_code = parse_preview_identity(
        app_version,
        "Private source",
    )

    manifest = json.loads(PREVIEW_MANIFEST.read_text(encoding="utf-8"))
    published_name = str(manifest.get("latest_version_name") or "")
    published_code = int(manifest.get("latest_version_code") or 0)
    published_match = re.fullmatch(r"2\.0\.0-preview\.(\d+)", published_name)
    if published_match is None:
        raise RuntimeError("Activated Preview manifest identity is missing or invalid")
    published_sequence = int(published_match.group(1))
    if published_code != 940000 + published_sequence:
        raise RuntimeError("Activated Preview manifest code does not match its suffix")
    if source_code not in {published_code, published_code + 1}:
        raise RuntimeError(
            "Private Preview source must equal the active manifest or be exactly one pending signed release ahead"
        )
    if source_sequence not in {published_sequence, published_sequence + 1}:
        raise RuntimeError("Private Preview source suffix is outside the safe release window")

    changed: list[Path] = []
    update_checker = installer.UPDATE_CHECKER.read_text(encoding="utf-8")
    fallback_name, _, fallback_code = parse_preview_identity(
        update_checker,
        "Updater fallback",
    )
    if fallback_code not in {published_code, source_code} or fallback_name not in {published_name, source_name}:
        aligned = align_updater_fallback(update_checker, source_name, source_code)
        if aligned == update_checker:
            raise RuntimeError("Updater fallback could not be aligned with the pending Preview identity")
        installer.UPDATE_CHECKER.write_text(aligned, encoding="utf-8")
        update_checker = aligned
        changed.append(installer.UPDATE_CHECKER)
        fallback_name, _, fallback_code = parse_preview_identity(
            update_checker,
            "Aligned updater fallback",
        )

    if fallback_code not in {published_code, source_code}:
        raise RuntimeError("Updater fallback must match the active or pending Preview identity")
    if fallback_name not in {published_name, source_name}:
        raise RuntimeError("Updater fallback name is outside the safe Preview identity window")

    required_markers = (
        "const VERSION = window.AmyFXAppVersion ||",
        PRIVATE_MANIFEST_URL,
        f"name: '{source_name}', code: {source_code}",
    )
    combined = f"{app_version}\n{update_checker}"
    missing = [marker for marker in required_markers if marker not in combined]
    if missing:
        raise RuntimeError(
            f"Private Preview updater identity is incomplete: {', '.join(missing)}"
        )

    return changed


def main() -> None:
    installer = load_installer()
    installer.normalize_source_identity = lambda: preserve_private_preview_identity(installer)
    installer.main()


if __name__ == "__main__":
    main()
