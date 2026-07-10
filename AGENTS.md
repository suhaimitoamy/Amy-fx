# Amy FX Agent Instructions

This repo uses local project memory stored in `.agent-memory/`.

## Before Working on Any Task

Read these files in order:

1. `.agent-memory/PROJECT_CONTEXT.md` — what this project is and how it's structured
2. `.agent-memory/RULES.md` — what you must NOT do
3. `.agent-memory/DECISIONS.md` — what was already decided
4. `.agent-memory/BUG_HISTORY.md` — bugs fixed and known issues
5. `.agent-memory/FEATURE_HISTORY.md` — features already implemented
6. `.agent-memory/TODO_MEMORY.md` — pending tasks

## Core Rules

- Make minimal changes.
- Prefer additive changes.
- Do not refactor unless explicitly requested.
- Do not change working logic unless explicitly requested.
- Do not store secrets (API keys, tokens, passwords).
- Do not add dependencies unless explicitly requested.
- Keep Vercel serverless compatibility.
- For Android WebView asset links, use explicit `index.html`.

## After Completing a Task

- Summarize changed files.
- Update `.agent-memory/DECISIONS.md` if a technical decision was made.
- Update `.agent-memory/BUG_HISTORY.md` if a bug was fixed or discovered.
- Update `.agent-memory/FEATURE_HISTORY.md` if a feature was added.
- Update `.agent-memory/TODO_MEMORY.md` if new pending work appears.
