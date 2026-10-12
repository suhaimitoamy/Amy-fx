# Amy FX Private branch instructions

This branch is the permanent private Amy FX product line.

- Work only on `personal/amyfx-private`.
- Never modify, merge into, rebase onto, force-push, or release from `main` without explicit owner authorization.
- `main` is the stable public Amy FX application.
- Preserve the private Android identity:
  - application ID `com.amyelitesuite.learningpreview`
  - app label `Amy FX Preview`
  - URI scheme `amyfxpreview`
  - permanent Preview signing certificate
  - private Preview update channel and user data compatibility
- Do not modify production `update.json`, production workflows, public package identity, public signing, or public release assets.
- Audit and explain the proposed change before coding, then wait for explicit permission unless permission was already given in the same conversation.
- Run relevant JavaScript regression tests, Android unit tests, lint, signed build, package verification, and updater verification before calling a release complete.

Read `AMYFX_PRIVATE_PROJECT_RULES.md` as the source of truth for this branch.
