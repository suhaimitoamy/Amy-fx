#!/usr/bin/env python3
"""Adapt Preview regression assertions to the Amy FX production release identity."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Preview-only release/connectivity tests validate Preview workflows and files that
# must not exist in production. They are intentionally excluded from the public
# release suite. The production parity test with the preview-* filename is kept.
EXCLUDED_PREVIEW_TESTS = {
    "blueprint-preview-stabilization.test.mjs",
    "blueprint-preview-v1.test.mjs",
    "personal-source-debug.test.mjs",
}

# Apply identity substitutions only to positive assertions and fixtures. Negative
# assertions must keep Preview markers so they continue proving that Preview
# package names, URI schemes, APK paths, and update channels do not leak into
# production.
POSITIVE_REPLACEMENTS = {
    "preview-update.json": "update.json",
    r"preview-update\.json": r"update\.json",
    "personal/amyfx-private/preview-update.json": "main/update.json",
    r"personal\/amyfx-private\/preview-update\.json": r"main\/update\.json",
    "2.0.0-preview.307": "2.3.0",
    r"2\.0\.0-preview\.307": r"2\.3\.0",
    "2.2.1": "2.3.0",
    r"2\.2\.1": r"2\.3\.0",
    "940307": "58",
    "code: 57": "code: 58",
    "code 57": "code 58",
    r"\?: 57\)": r"\?: 58\)",
    r"code:\s*57": r"code:\s*58",
    "<= 57": "<= 58",
    "Amy FX Preview": "Amy FX",
    "com.amyelitesuite.learningpreview": "com.amyelitesuite",
    r"com\.amyelitesuite\.learningpreview": r"com\.amyelitesuite",
    "amyfxpreview": "amyfx",
    "amyfx.preview.scalper.permanent-history.v1": "amyfx.production.scalper.permanent-history.v1",
    r"amyfx\.preview\.scalper\.permanent-history\.v1": r"amyfx\.production\.scalper\.permanent-history\.v1",
}

NEGATIVE_ASSERTION_MARKERS = (
    "doesNotMatch",
    "not.match",
    "includes(",
    "=== false",
    ", false)",
)

PRODUCTION_ANALYSIS_IDENTITY_BLOCK = """test('production source identity is never behind the activated update manifest', () => {
  const match = appVersion.match(/name:\\s*'(\\d+\\.\\d+\\.\\d+)'\\s*,\\s*code:\\s*(\\d+)/);
  assert.ok(match, 'Production source identity must be readable');

  const [, sourceName, sourceCodeText] = match;
  const sourceCode = Number(sourceCodeText);
  const publishedCode = Number(updateManifest.latest_version_code);
  const publishedName = String(updateManifest.latest_version_name || '');

  assert.equal(sourceName, '2.3.0');
  assert.equal(sourceCode, 58);
  assert.ok(sourceCode >= publishedCode, 'Production source must not be older than update.json');
  assert.ok(sourceCode - publishedCode <= 1, 'Pending source may be at most one version ahead of the active APK');
  if (sourceCode === publishedCode) assert.equal(publishedName, sourceName);
});
"""


def excluded(path: Path) -> bool:
    if path.name in EXCLUDED_PREVIEW_TESTS:
        return True
    return path.name.startswith("preview-") and path.name != "preview-production-feature-parity.test.mjs"


def normalize_line(line: str) -> str:
    # Keep explicit negative assertions intact. This also preserves their test
    # value after the runtime itself is promoted to the production identity.
    if any(marker in line for marker in NEGATIVE_ASSERTION_MARKERS):
        return line
    updated = line
    for old, new in POSITIVE_REPLACEMENTS.items():
        updated = updated.replace(old, new)
    return updated


def normalize_file(path: Path, original: str) -> str:
    updated = "".join(normalize_line(line) for line in original.splitlines(keepends=True))
    if path.name == "analysis-static-layout.test.mjs":
        marker = "test('Preview source identity is never behind the activated update manifest'"
        alternate = "test('Amy FX source identity is never behind the activated update manifest'"
        start = updated.find(marker)
        if start < 0:
            start = updated.find(alternate)
        if start >= 0:
            updated = updated[:start] + PRODUCTION_ANALYSIS_IDENTITY_BLOCK
    return updated


changed = 0
removed = 0
for path in (ROOT / "tests").glob("*.test.mjs"):
    if excluded(path):
        path.unlink()
        removed += 1
        continue
    original = path.read_text(encoding="utf-8")
    updated = normalize_file(path, original)
    if updated != original:
        path.write_text(updated, encoding="utf-8")
        changed += 1

print(
    f"Normalized {changed} Preview regression tests for Amy FX production 2.3.0 (58); "
    f"excluded {removed} Preview-only workflow/connectivity tests."
)
