from pathlib import Path

p = Path("app/src/main/java/com/amyelitesuite/ScannerService.kt")
if not p.exists():
    raise SystemExit("ScannerService.kt tidak ditemukan. Jalankan dari root folder amy-elite-suite.")

s = p.read_text()

if "lastMarketAlertAt" not in s:
    s = s.replace(
        '    private val lastAlertAt = mutableMapOf<String, Long>()\n',
        '    private val lastAlertAt = mutableMapOf<String, Long>()\n'
        '    @Volatile private var lastMarketAlertAt = 0L\n'
        '    private var lastMarketAlertSignature = ""\n'
    )

start = s.find('        events.add(\n            NativeEvent(\n                "PHASE-$phase-${latest.openTime}",')
if start != -1:
    end = s.find('\n        if (body >= a * 1.5', start)
    if end != -1:
        s = s[:start] + s[end + 1:]

old = '''    private fun sendDedupedAlert(key: String, title: String, message: String) {
        val now = System.currentTimeMillis()
        val last = lastAlertAt[key] ?: 0L
        if (now - last < 10 * 60 * 1000L) return
        lastAlertAt[key] = now
        sendAlertNotification(title, message)
    }
'''

new = '''    private fun sendDedupedAlert(key: String, title: String, message: String) {
        val now = System.currentTimeMillis()
        val last = lastAlertAt[key] ?: 0L
        if (now - last < 10 * 60 * 1000L) return

        val signature = title + "|" + message.lineSequence().take(5).joinToString("|")
        if (signature == lastMarketAlertSignature && now - lastMarketAlertAt < 30 * 60 * 1000L) return
        if (now - lastMarketAlertAt < 90 * 1000L) return

        lastAlertAt[key] = now
        lastMarketAlertSignature = signature
        lastMarketAlertAt = now
        sendAlertNotification(title, message)
    }
'''

if old in s:
    s = s.replace(old, new)

s = s.replace(
    '        nm.notify(System.currentTimeMillis().toInt(), notification)',
    '        nm.notify(2, notification)'
)

p.write_text(s)
print("OK: notification spam fix applied.")
