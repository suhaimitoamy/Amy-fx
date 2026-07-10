# Amy FX Memory Skill

Use this skill when working on Amy FX.

Always check `.agent-memory/` before editing any file.

## Memory Update Rules

| Event | Update File |
|-------|------------|
| New bug found | `BUG_HISTORY.md` |
| Bug fixed | `BUG_HISTORY.md` |
| New feature added | `FEATURE_HISTORY.md` |
| New technical decision | `DECISIONS.md` |
| New pending work | `TODO_MEMORY.md` |
| Major memory update | `CHANGELOG_MEMORY.md` |

## Never Store in Memory

- API keys (TwelveData, Gemini, OpenRouter, DeepSeek, etc.)
- Telegram bot tokens
- Supabase keys
- Passwords or private user credentials
- Any secret or token

## Quick Reference

- Project location: `/sdcard/Download/Amy-fx/`
- Agent instructions: `AGENTS.md` (repo root)
- Memory folder: `.agent-memory/`
- Read order: PROJECT_CONTEXT → RULES → DECISIONS → BUG_HISTORY → FEATURE_HISTORY → TODO_MEMORY
