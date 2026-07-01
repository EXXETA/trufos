# CLAUDE.md

Guidance for Claude Code when working in this repository.

**The canonical project guide is [`AGENTS.md`](./AGENTS.md).** Read it first — it covers the
project overview, architecture, tech stack, code conventions, development commands, testing,
and commit/branch rules. The notes below only add Claude-specific reminders.

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
- Follow Conventional Commits and the branch naming rules described in `AGENTS.md`.
- Reference an existing GitHub issue in every branch and PR.
- For `design needed` issues, read the design from the preconfigured `penpot` MCP server
  (`.mcp.json`) before implementing when Penpot is the linked design source. Setup and usage
  are documented in `AGENTS.md` (section "Designs (Penpot via MCP)"); run `/mcp` to check the
  connection.
