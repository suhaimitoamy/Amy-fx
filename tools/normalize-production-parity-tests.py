#!/usr/bin/env python3
"""Adapt Preview regression assertions to the Amy FX production release identity."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OVERLAY_MANIFEST = ROOT / "tools/production-test-overlays.txt"
PRODUCTION_OVERLAYS = {
    line.strip()
    for line in OVERLAY_MANIFEST.read_text(encoding="utf-8").splitlines()
    if line.strip()
} if OVERLAY_MANIFEST.exists() else set()

EXCLUDED_PREVIEW_TESTS = {
    "blueprint-preview-stabilization.test.mjs",
    "blueprint-preview-v1.test.mjs",
    "personal-source-debug.test.mjs",
}

POSITIVE_REPLACEMENTS = {
    "preview-update.json": "update.json",
    r"preview-update\.json": r"update\.json",
    "personal/amyfx-private/preview-update.json": "main/update.json",
    r"personal\/amyfx-private\/preview-update\.json": r"main\/update\.json",
    "2.0.0-preview.310": "2.3.1",
    r"2\.0\.0-preview\.310": r"2\.3\.1",
    "2.0.0-preview.307": "2.3.1",
    r"2\.0\.0-preview\.307": r"2\.3\.1",
    "2.3.0": "2.3.1",
    r"2\.3\.0": r"2\.3\.1",
    "2.2.1": "2.3.1",
    r"2\.2\.1": r"2\.3\.1",
    "940310": "59",
    "940307": "59",
    "code: 58": "code: 59",
    "code 58": "code 59",
    "code: 57": "code: 59",
    "code 57": "code 59",
    r"\?: 58\)": r"\?: 59\)",
    r"\?: 57\)": r"\?: 59\)",
    r"code:\s*58": r"code:\s*59",
    r"code:\s*57": r"code:\s*59",
    "<= 58": "<= 59",
    "<= 57": "<= 59",
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

PRODUCTION_IDENTITY_TEST = """test('production source identity matches the activated signed manifest', () => {
  const appVersion = fs.readFileSync('app/src/main/assets/app-version.js', 'utf8');
  const manifest = JSON.parse(fs.readFileSync('update.json', 'utf8'));
  const match = appVersion.match(/name:\\s*'(\\d+\\.\\d+\\.\\d+)'\\s*,\\s*code:\\s*(\\d+)/);
  assert.ok(match, 'Production source identity must be readable');

  const [, sourceName, sourceCodeText] = match;
  const sourceCode = Number(sourceCodeText);
  assert.equal(sourceName, '2.3.1');
  assert.equal(sourceCode, 59);
  assert.equal(String(manifest.latest_version_name || ''), sourceName);
  assert.equal(Number(manifest.latest_version_code), sourceCode);
  assert.match(appVersion, /main\\/update\\.json/);
  assert.doesNotMatch(appVersion, /personal\\/amyfx-private|preview-update\\.json|learningpreview|amyfxpreview/);
});
"""


def excluded(path: Path) -> bool:
    if path.name in EXCLUDED_PREVIEW_TESTS:
        return True
    return path.name.startswith("preview-") and path.name != "preview-production-feature-parity.test.mjs"


def normalize_line(line: str) -> str:
    if any(marker in line for marker in NEGATIVE_ASSERTION_MARKERS):
        return line
    updated = line
    for old, new in POSITIVE_REPLACEMENTS.items():
        updated = updated.replace(old, new)
    return updated


def apply_special_rewrites(path: Path, content: str) -> str:
    if path.name == "six-issues-regression.test.mjs":
        marker = "test('Preview source identity is current and no more than one signed build ahead of manifest'"
        position = content.find(marker)
        if position < 0:
            raise SystemExit(f"Missing expected Preview identity block in {path.name}")
        return content[:position] + PRODUCTION_IDENTITY_TEST
    return content


changed = 0
removed = 0
preserved = 0
for path in (ROOT / "tests").glob("*.test.mjs"):
    if excluded(path):
        path.unlink()
        removed += 1
        continue
    if path.name in PRODUCTION_OVERLAYS:
        preserved += 1
        continue
    original = path.read_text(encoding="utf-8")
    updated = "".join(normalize_line(line) for line in original.splitlines(keepends=True))
    updated = apply_special_rewrites(path, updated)
    if updated != original:
        path.write_text(updated, encoding="utf-8")
        changed += 1

print(
    f"Normalized {changed} Preview regressions for Amy FX production 2.3.1 (59); "
    f"preserved {preserved} production overlays; excluded {removed} Preview-only tests."
)
