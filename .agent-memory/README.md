# Amy FX — Agent Memory System

> Folder ini adalah **project memory** untuk AI coding agent (Antigravity, Hermes, atau agent lain yang bekerja di repo ini). Memory ini berbasis file lokal, mudah dibaca manusia, dan tidak boleh berisi secret.

---

## Fungsi Folder

`.agent-memory/` menyimpan konteks, aturan, keputusan, riwayat bug, riwayat fitur, dan daftar tugas yang belum selesai. Tujuannya agar agent **tidak lupa** konteks project lintas sesi — tanpa bergantung pada external memory service.

## Cara Agent Membaca Memory

**Sebelum mulai mengerjakan task apapun**, agent WAJIB membaca file-file ini secara berurutan:

1. `PROJECT_CONTEXT.md` — apa project ini, strukturnya, dan hubungan antar bagian
2. `RULES.md` — aturan permanen yang tidak boleh dilanggar
3. `DECISIONS.md` — keputusan teknis yang sudah dibuat (agar tidak mengulang atau membatalkan)
4. `BUG_HISTORY.md` — bug yang sudah diperbaiki dan yang masih diketahui
5. `FEATURE_HISTORY.md` — fitur yang sudah diimplementasi
6. `TODO_MEMORY.md` — tugas yang belum dikerjakan

## Aturan Update Memory

- **Bug ditemukan atau diperbaiki** → update `BUG_HISTORY.md`
- **Fitur baru ditambahkan** → update `FEATURE_HISTORY.md`
- **Keputusan teknis dibuat** → update `DECISIONS.md`
- **Tugas baru muncul** → update `TODO_MEMORY.md`
- **Perubahan besar pada memory** → update `CHANGELOG_MEMORY.md`
- Jangan hapus entry lama — hanya tambahkan atau tandai sebagai resolved/superseded
- Format tanggal: `YYYY-MM-DD`

## ⛔ Larangan

**JANGAN PERNAH** menyimpan hal berikut di file memory manapun:

- API key (TwelveData, Gemini, OpenRouter, DeepSeek, dll)
- Telegram bot token
- Supabase key
- Password atau credential
- Private user data

## File dalam Folder Ini

| File | Isi |
|------|-----|
| `PROJECT_CONTEXT.md` | Konteks utama project, arsitektur, dan struktur folder |
| `RULES.md` | Aturan permanen untuk agent |
| `DECISIONS.md` | Keputusan teknis yang sudah dibuat |
| `BUG_HISTORY.md` | Riwayat bug (fixed dan known issues) |
| `FEATURE_HISTORY.md` | Riwayat fitur yang sudah diimplementasi |
| `TODO_MEMORY.md` | Daftar tugas yang belum dikerjakan |
| `CHANGELOG_MEMORY.md` | Log perubahan pada memory itu sendiri |
| `PROMPT_MEMORY.md` | Prompt standar sebelum mulai kerja |
