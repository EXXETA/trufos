# Trufos – GitHub Copilot Workspace Instructions

## Project Overview

Trufos is a cross-platform desktop REST client built with **Electron**, **React 19**, and **TypeScript**. It uses Vite for bundling, Zustand for state management, Tailwind CSS with Radix UI (shadcn/ui) components, and Vitest + Testing Library for tests.

## Architecture

The project follows Electron's two-process model:

- **`src/main/`** – Main process (Node.js): file system, networking, persistence, IPC event handling
- **`src/renderer/`** – Renderer process (React): UI components, state, services calling the main process via IPC
- **`src/shim/`** – Shared types and utilities used across both processes

Key renderer directories:
- `components/` – Reusable React components (use shadcn/ui + Radix UI primitives)
- `state/` – Zustand stores
- `services/` – Business logic / IPC calls
- `contexts/` – React contexts
- `view/` – Page-level components

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | Electron + React 19 |
| Language | TypeScript (strict mode) |
| Bundler | Vite |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix UI) |
| State | Zustand + Immer |
| Testing | Vitest + Testing Library |
| Linting | ESLint + Prettier |
| Package manager | Yarn v4 (Berry) |

## Code Conventions

- All code must be **TypeScript** with strict typing – avoid `any`.
- Use **functional React components** with hooks; no class components.
- Prefer **named exports** over default exports for components and utilities.
- Use **Tailwind CSS** utility classes for styling; avoid inline styles.
- Use **shadcn/ui** components before writing custom UI primitives.
- State that is shared across components belongs in a **Zustand store** (`src/renderer/state/`).
- IPC communication must go through typed handlers defined in `src/main/event/` and exposed via preload.
- Use **Zod** for runtime validation and schema definitions.
- Use **Winston** for logging in the main process.

## Commit & Branch Guidelines

- Commit messages must reference the issue: `#<issue-id> - <description in present tense>`
  - Example: `#42 - add request body editor for JSON payloads`
- Branch names follow the pattern: `<type>/<issue-id>-<short-description>`
  - Types: `feature`, `fix`, `tmp`
  - Example: `feature/42-json-body-editor`

## Development Commands

```bash
yarn start          # Start Electron app in development mode
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
