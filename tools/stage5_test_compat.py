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

notification_test = root / "tests/notification-route-regression.test.mjs"
notification_text = notification_test.read_text(encoding="utf-8")
old_notification_assertion = "  assert.match(activity, /url \\?: AmyFxNotificationGate\\.routeUrl\\(route\\)/);"
new_notification_assertion = "  assert.match(activity, /normalizeLocalUrl\\(url\\)[\\s\\S]*\\?: AmyFxNotificationGate\\.routeUrl\\(route\\)/);"
if old_notification_assertion not in notification_text:
    raise RuntimeError("Notification route assertion marker missing")
notification_test.write_text(
    notification_text.replace(old_notification_assertion, new_notification_assertion, 1),
    encoding="utf-8",
)

api_path = root / "api/twelvedata.js"
api_text = api_path.read_text(encoding="utf-8")
old_request = """    const params = new URLSearchParams({
      symbol,
      interval,
      outputsize: String(safeOutputSize),
      timezone: 'UTC',
      apikey: targetKey
    });
    const response = await fetch(`https://api.twelvedata.com/time_series?${params}`, {
"""
new_request = """    const fetchUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${safeOutputSize}&timezone=UTC&apikey=${encodeURIComponent(targetKey)}`;
    const response = await fetch(fetchUrl, {
"""
if old_request not in api_text:
    raise RuntimeError("TwelveData UTC request marker missing")
api_path.write_text(api_text.replace(old_request, new_request, 1), encoding="utf-8")

readme_path = root / "README.md"
readme = readme_path.read_text(encoding="utf-8")
old_release_header = "> **Versi:** `1.4.6`  \n> **Version code:** `29`"
new_release_header = "> **Versi:** `1.4.6`\n>\n> **Version code:** `29`"
if old_release_header not in readme:
    raise RuntimeError("README release header marker missing")
readme = readme.replace(old_release_header, new_release_header, 1)
readme = readme.replace("> **Version code:** `29`  \n", "> **Version code:** `29`\n", 1)
readme_path.write_text(readme, encoding="utf-8")

Path(__file__).unlink()
