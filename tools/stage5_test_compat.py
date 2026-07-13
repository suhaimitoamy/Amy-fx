from pathlib import Path

root = Path(__file__).resolve().parents[1]
updated = 0

for path in (root / "tests").glob("*.test.mjs"):
    text = path.read_text(encoding="utf-8")
    if "profile displays Amy FX version 1.4.5" not in text:
        continue
    new_text = text.replace(
        "profile displays Amy FX version 1.4.5",
        "profile displays Amy FX version 1.4.6",
    )
    new_text = new_text.replace("name: '1\\.4\\.5'", "name: '1\\.4\\.6'")
    new_text = new_text.replace("code: 28", "code: 29")
    if new_text == text:
        raise RuntimeError(f"Version assertions were not updated in {path}")
    path.write_text(new_text, encoding="utf-8")
    updated += 1

if updated != 1:
    raise RuntimeError(f"Expected exactly one existing app-version test, updated {updated}")

Path(__file__).unlink()
