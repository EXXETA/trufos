---
mode: agent
description: Fetch a GitHub issue by number and implement it in the Trufos codebase
tools: ['codebase', 'editFiles', 'runCommands', 'githubRepo', 'search', 'problems']
---

# Implement GitHub Issue

## Goal

Fetch a GitHub issue from the `EXXETA/trufos` repository, understand its requirements, and implement the changes following all project conventions.

## Input

Issue number: `${input:issueNumber:GitHub issue number to implement (e.g. 42)}`

## Process

### Step 1 – Fetch & Understand the Issue

1. Read the full issue (title, body, labels, linked issues, and all comments) for issue `#${input:issueNumber}`.
2. Identify:
   - What needs to be done (feature, fix, refactor)
   - Acceptance criteria (if stated)
   - Any design decisions already discussed in comments
3. If the issue is unclear or underspecified, ask the user for clarification **before** writing any code.

### Step 2 – Gather Codebase Context

1. Read `.github/copilot-instructions.md` for project conventions.
2. Identify all source files relevant to the issue (use search and codebase tools).
3. Review existing patterns in the affected area (IPC handlers, Zustand stores, components).
4. Check existing tests for the affected files to understand expected behaviour.

### Step 3 – Plan the Implementation

Present a concise implementation plan **in the chat** before writing any code:

- Files to create / modify / delete
- IPC channel changes (if any)
- State management changes (if any)
- Testing approach

Wait for the user to approve the plan before proceeding.

### Step 4 – Create a Branch

Create and switch to a new branch following the project convention:

```
git checkout -b <type>/<issue-id>-<short-description>
```

- `<type>`: `feature` for new functionality, `fix` for bug fixes
- `<issue-id>`: the issue number (e.g. `42`)
- `<short-description>`: kebab-case summary (e.g. `json-body-editor`)

Example: `git checkout -b feature/42-json-body-editor`

### Step 5 – Implement

Follow all conventions from `.github/instructions/`:

- **TypeScript / React:** strict types, functional components, Zustand, Tailwind, Radix UI
- **Electron IPC:** define types in `src/shim/`, validate with Zod, implement handler in `src/main/event/`
- **Error handling:** typed errors, Winston logging (main), `sonner` toasts (renderer)
- No `any` types, no commented-out code, no inline styles

### Step 6 – Test

Run the full test suite and fix any failures:

```bash
yarn test
```

Run linting and formatting checks:

```bash
yarn lint
yarn prettier-check
```

### Step 7 – Commit

Stage and commit using the project's commit format:

```bash
git add .
git commit -m "#<issue-id> - <present-tense description of what was done>"
```

Example: `git commit -m "#42 - add JSON body editor to request panel"`

## Quality Checklist

Before considering the implementation done, verify:

- [ ] All acceptance criteria from the issue are met
- [ ] No `any` types introduced
- [ ] IPC channel types defined in `src/shim/` (if applicable)
- [ ] Zod validation added for IPC payloads (if applicable)
- [ ] Tests written and passing (`yarn test`)
- [ ] Linting passes (`yarn lint`)
- [ ] Formatting correct (`yarn prettier-check`)
- [ ] Error states handled and shown to the user
- [ ] No temporary or debug code left behind
