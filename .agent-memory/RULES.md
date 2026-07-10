# Permanent Rules

## Universal Rules

- Do not refactor unless explicitly requested.
- Do not change working logic unless explicitly requested.
- Prefer additive changes — add new code, don't rewrite existing code.
- Do not add npm dependencies unless explicitly requested.
- Do not store secrets in files (API keys, tokens, passwords, credentials).
- Do not hardcode API keys.
- Keep serverless functions compatible with Vercel.
- Use native `fetch` when possible — no external HTTP libraries.
- For Android WebView assets, use explicit `index.html` path instead of folder-only links.
- Before editing, check related files first.
- After editing, summarize changed files.
- Do not delete existing files unless explicitly requested.
- Make the smallest safe change possible.

## Amy FX Specific Rules

- Jangan ubah logic heatmap lama (`computeHeatmap` di `api/heatmap.js`).
- Jangan ubah logic scraping Telegram (`extractPosts`, `filterGold` di `api/news.js`) kalau tidak diminta.
- Jangan ubah struktur Academy besar-besaran — materi tersebar di banyak folder `bagian-XX-*/`.
- Jangan sentuh `MainActivity.kt` kalau masalah cukup selesai di HTML/JS.
- File serverless baru harus **independen** — copy logic yang diperlukan, jangan import dari file lain.
- `API_BASE` di `apps/market-intel/app.js` hardcoded ke `https://amy-fx.vercel.app/api` — jangan ubah tanpa izin.
- Semua panel Market Intel (News, Heatmap, Liquidity) harus independen satu sama lain — error di satu panel tidak boleh mempengaruhi panel lain.

## Memory Rules

- Update memory setelah menyelesaikan task yang menghasilkan keputusan, fix bug, atau fitur baru.
- Jangan hapus entry lama di memory — tandai sebagai resolved/superseded.
- Jangan simpan secret apapun di folder `.agent-memory/`.
