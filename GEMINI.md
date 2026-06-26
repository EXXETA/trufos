# GEMINI.md

Guidance for Google Gemini (Gemini CLI / Code Assist) when working in this repository.

**The canonical project guide is [`AGENTS.md`](./AGENTS.md).** Read it first — it covers the
project overview, architecture, tech stack, code conventions, development commands, testing,
and commit/branch/PR rules. The notes below only add Gemini-specific reminders.

## Quick Reference

```bash
yarn start          # Start the Electron app in development mode
yarn test           # Run Vitest tests
yarn lint           # Run ESLint
yarn prettier-check # Check formatting
```

## Working Notes

- Electron two-process split: `src/main/` (Node), `src/renderer/` (React), `src/shim/`
  (shared). Cross-process communication goes through typed IPC handlers in `src/main/event/`.
- TypeScript with strict typing — never introduce `any`.
- After changes, run `yarn test` and `yarn lint` on the touched files before committing.
- Follow Conventional Commits and the branch/PR conventions described in `AGENTS.md`.
- Reference an existing GitHub issue in every branch and PR. The PR body **must** mention an
  issue (e.g. `Closes #<id>`); the `conventional-pr` CI check runs `strict: true` and fails
  the pipeline otherwise. If no issue exists, create one first, then link it.
