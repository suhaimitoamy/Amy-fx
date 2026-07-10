# Standard Working Prompt

Before making changes:

1. Read `.agent-memory/PROJECT_CONTEXT.md` — understand the project
2. Read `.agent-memory/RULES.md` — know what you must NOT do
3. Read `.agent-memory/DECISIONS.md` — know what was already decided
4. Check `.agent-memory/BUG_HISTORY.md` — don't re-introduce fixed bugs
5. Check `.agent-memory/FEATURE_HISTORY.md` — don't duplicate existing features
6. Check `.agent-memory/TODO_MEMORY.md` — see if the task is already listed

Then:

- Identify files related to the task.
- Make the smallest safe change.
- Do not refactor unless explicitly requested.
- Do not change working logic unless explicitly requested.
- Prefer additive changes over rewrites.
- Test mentally: "will this break existing features?"

After completing the task:

- Summarize changed files.
- Update `.agent-memory/DECISIONS.md` if a technical decision was made.
- Update `.agent-memory/BUG_HISTORY.md` if a bug was fixed or discovered.
- Update `.agent-memory/FEATURE_HISTORY.md` if a feature was added.
- Update `.agent-memory/TODO_MEMORY.md` if new pending work appears.
- Update `.agent-memory/CHANGELOG_MEMORY.md` if memory was updated significantly.
