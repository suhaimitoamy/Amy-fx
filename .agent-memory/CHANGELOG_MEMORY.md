# Memory Changelog

## 2026-07-29
- Recorded terminal lifecycle propagation, injectable replay session time, causal forecast/sweep/MSS ordering, structural-target diagnosis, and paired-leg Dealing Location decisions.
- Added fixed defect history for terminal-state loss, replay wall-clock contamination, pre-forecast sweeps, unpaired dealing anchors, and hidden risk diagnosis.
- Recorded the 2021–2022 validation result: Dealing Location is no longer the M5 blocker; SESSION is the next cumulative blocker and setup remains zero without threshold changes.
- Added follow-up to validate lifecycle only when an unchanged-gate setup occurs naturally.

## 2026-07-28
- Recorded Mapping Accuracy V3 as the successor to M15-only execution.
- Added all-timeframe causal-entry, single-authority, H1 suppression, zone lifecycle, previous-period causality, and Monday-anchored W1 decisions.
- Locked M5 entry context to H4 and added point-in-time HTF/EMA-stack plus H1 EMA-distance entry gates.
- Added the fixed defect history and manual validation follow-up.

## 2026-07-10
- Created project memory structure (`.agent-memory/` folder).
- Added `README.md` — explains memory system, read order, update rules, security restrictions.
- Added `PROJECT_CONTEXT.md` — Amy FX architecture, folder map, data flow.
- Added `RULES.md` — permanent rules (universal + Amy FX specific).
- Added `DECISIONS.md` — technical decisions from initial implementation session.
- Added `BUG_HISTORY.md` — admin link fix + 4 known issues.
- Added `FEATURE_HISTORY.md` — 5 features implemented (admin fix, news translation, news expand, liquidity tab, liquidity API).
- Added `TODO_MEMORY.md` — 5 pending tasks.
- Added `PROMPT_MEMORY.md` — standard working prompt for agents.
- Added `CHANGELOG_MEMORY.md` — this file.
- Added `AGENTS.md` at repo root — entry point for any agent.
- Added `.agents/skills/amy-fx-memory.md` — skill for memory update workflow.
