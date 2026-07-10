# Amy FX Production Roadmap Status

## Selesai / Masuk Overlay Ini

- Repo cleanup script.
- WebView error page.
- WebView hardening patch script.
- Design system shared CSS.
- Shared JS utilities: toast, theme toggle, copy feedback, session info.
- MTF confluence helper.
- ICT card output helper.
- Journal schema, validation, analytics, AI prompt, CSV export helper.
- Indicator manifest v2 with categories.
- Indicator library helper: search, favorite, preview, export selected.
- Update checker Kotlin class.
- Market data retry/cache helper.
- Session clock helper.
- Additional unit tests.
- Android UI smoke test.
- Privacy Policy, Terms of Use, Store Listing draft.

## Masih Butuh Integrasi Manual UI

File helper sudah tersedia, tetapi HTML module lama perlu memanggil script berikut:

```html
<link rel="stylesheet" href="../shared/amyfx-design-system.css">
<script src="../shared/amyfx-common.js"></script>
```

Mapping tambahan:

```html
<script src="mtf-confluence.js"></script>
<script src="ict-output-cards.js"></script>
```

Journal tambahan:

```html
<script src="journal-schema.js"></script>
<script src="journal-analytics.js"></script>
<script src="journal-ai-prompt.js"></script>
<script src="journal-export.js"></script>
```

Indikator tambahan:

```html
<script src="indicator-library-v2.js"></script>
```

## Perintah Apply di Termux

```bash
cd ~/Download/Amy-fx
unzip -o ../amyfx-full-upgrade-overlay-20260625.zip -d .
chmod +x scripts/apply-production-upgrade.sh
bash scripts/apply-production-upgrade.sh
git commit -m "production upgrade phase 2"
git push origin main
```
