# AGENTS.md – Trufos

Canonical guide for AI coding agents (Codex, Cursor, Claude Code, GitHub Copilot, etc.)
working in this repository. Tool-specific entry files (`CLAUDE.md`,
`.github/copilot-instructions.md`) defer to this document for the detailed rules.

## Project Overview

Trufos is a cross-platform desktop REST client built with **Electron**, **React 19**, and
**TypeScript**. It uses Vite for bundling, Zustand (+ Immer) for state management, Tailwind
CSS v4 with Radix UI (shadcn/ui) components, and Vitest + Testing Library for tests.

## Architecture

The project follows Electron's two-process model:

- **`src/main/`** – Main process (Node.js): file system, networking, persistence, IPC event
  handling.
- **`src/renderer/`** – Renderer process (React): UI components, state, services calling the
  main process via IPC.
- **`src/shim/`** – Shared types and utilities used across both processes.

Key renderer directories:

- `components/` – Reusable React components (use shadcn/ui + Radix UI primitives).
- `state/` – Zustand stores.
- `services/` – Business logic / IPC calls.
- `contexts/` – React contexts.
- `view/` – Page-level components.

## Tech Stack

| Concern         | Technology                          |
| --------------- | ----------------------------------- |
| Framework       | Electron + React 19                 |
| Language        | TypeScript (`noImplicitAny: true`)  |
| Bundler         | Vite                                |
| Styling         | Tailwind CSS v4 + shadcn/ui (Radix) |
| State           | Zustand + Immer                     |
| Validation      | Zod                                 |
| Logging (main)  | Winston                             |
| Testing         | Vitest + Testing Library            |
| Linting         | ESLint + Prettier                   |
| Package manager | Yarn v4 (Berry)                     |

## Code Conventions

- All code must be **TypeScript** with strict typing – avoid `any`.
- Use **functional React components** with hooks; no class components.
- Prefer **named exports** over default exports for components and utilities.
- Use **Tailwind CSS** utility classes for styling; avoid inline styles.
- Use **shadcn/ui** components before writing custom UI primitives.
- State shared across components belongs in a **Zustand store** (`src/renderer/state/`).
- IPC communication must go through typed handlers defined in `src/main/event/` and exposed
  via preload.
- Use **Zod** for runtime validation and schema definitions.
- Use **Winston** for logging in the main process.

## Development Commands

```bash
yarn start          # Start the Electron app in development mode
yarn test           # Run Vitest tests
yarn lint           # Run ESLint
yarn prettier-check # Check formatting
yarn prettier       # Fix formatting
```

## Testing

- Write tests using **Vitest** and **@testing-library/react**.
- Place test files next to the source file or in `__tests__/` subdirectories.
- Mock Electron APIs and IPC calls when testing renderer components.
- Cover edge cases, error states, and async behaviour.

## Commit & Branch Conventions

Commit messages use **English present tense** following **Conventional Commits**:

```
<type>: <short description>
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`.

- Imperative mood ("add feature", not "added feature").
- First line under 72 characters, no trailing period.
- Optional body after a blank line explaining _why_.

Branch names follow:

```
<type>/<issue-id>-<short-description>
```

Types: `feature`, `fix`, `tmp`. Lowercase, hyphen-separated.
Example: `feature/42-json-body-editor`.

Always create or reference a GitHub issue before starting work.

## Pull Requests

- Open every PR against the `main` branch.
- Run `yarn test`, `yarn lint`, and `yarn prettier-check` and fix all failures before
  opening the PR.
- The PR title follows Conventional Commits, matching the main commit
  (e.g. `feat: add JSON body editor`).
- Fill in every section of `.github/pull_request_template.md` (Changes, Testing, Checklist).
  Tick checklist items only when they are actually done.
- Link the resolved issue with `Closes #<issue-id>` so it auto-closes on merge.
- Apply matching labels (`enhancement` for features, `bug` for fixes).
- Request a review from a second person; do not self-merge unreviewed changes.
- Use merge commits when merging into `main` (no fast-forward merges).

See `.github/prompts/create-pull-request.prompt.md` for the full step-by-step workflow.

## Designs (Penpot via MCP)

The UI design source of truth lives in Penpot. Before implementing a `design needed` issue,
fetch the relevant frame instead of guessing spacing/colors.

A `penpot` MCP server is preconfigured in `.mcp.json` (the [`penpot-mcp`](https://github.com/montevive/penpot-mcp)
server). It connects to the project's self-hosted Penpot instance and exposes the design
files as MCP tools/resources (list files, read frames, components, design tokens, export).

One-time setup (per developer):

1. Install [`uv`](https://docs.astral.sh/uv/) (provides `uvx`) and Python 3.12+.
2. Copy `.env.example` to `.env` and fill in your Penpot credentials
   (`PENPOT_USERNAME`, `PENPOT_PASSWORD`). `.env` is gitignored — never commit credentials.
   Prefer a dedicated read-only Penpot account.
3. Export those variables into the shell that launches your agent so `.mcp.json`'s
   `${PENPOT_USERNAME}` / `${PENPOT_PASSWORD}` resolve (e.g. `set -a; source .env; set +a`).
4. Approve/restart the MCP server in your client (Claude Code: confirm the `penpot` server,
   then `/mcp` to verify it is connected).

Then ask the agent to list the Trufos design files and read the frame for the screen you are
working on. The Penpot instance URL is set in `.mcp.json`.

## Further Reading

- `.github/instructions/` – topic-specific instructions (commits, testing, stack).
- `.github/prompts/` – reusable prompt workflows.
- `docs/architecture/` – architecture documentation.
- `CONTRIBUTING.md` – contribution guidelines.
