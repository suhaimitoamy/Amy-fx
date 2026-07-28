#!/usr/bin/env python3
"""Run Blueprint stabilization without replacing the private Preview version identity."""
from __future__ import annotations

import importlib.util
import re
from pathlib import Path

CORE_INSTALLER = Path(__file__).with_name("apply-blueprint-preview-core.py")
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


def preserve_private_preview_identity(installer) -> list[Path]:
    """Validate the personal Preview identity and leave versioned source untouched."""
    app_version = installer.APP_VERSION.read_text(encoding="utf-8")
    update_checker = installer.UPDATE_CHECKER.read_text(encoding="utf-8")

    version_match = re.search(
        r"const VERSION = Object\.freeze\(\{ name: '(2\.0\.0-preview\.\d+)', code: (94\d{4}) \}\);",
        app_version,
    )
    if version_match is None:
        raise RuntimeError("Private Preview version identity is missing or invalid")

    version_name, version_code = version_match.groups()
    required_markers = (
        PRIVATE_MANIFEST_URL,
        f"name: '{version_name}', code: {version_code}",
        f"Number(VERSION.code) || {version_code}",
        f"String(VERSION.name || '{version_name}')",
    )
    missing = [marker for marker in required_markers if marker not in app_version and marker not in update_checker]
    if missing:
        raise RuntimeError(f"Private Preview updater identity is incomplete: {', '.join(missing)}")

    return []


def main() -> None:
    installer = load_installer()
    installer.normalize_source_identity = lambda: preserve_private_preview_identity(installer)
    installer.main()


if __name__ == "__main__":
    main()
