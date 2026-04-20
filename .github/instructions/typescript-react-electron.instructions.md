---
applyTo: '**/*.ts,**/*.tsx'
description: TypeScript, React, and Electron coding standards for the Trufos project
---

# TypeScript, React & Electron Instructions

## TypeScript

- Respect `noImplicitAny: true` in `tsconfig.json`; never use `any` – use `unknown` with type guards if the type is truly unknown.
- Define explicit types and interfaces for all component props, function parameters, and return values.
- Use **Zod** for runtime validation and to derive TypeScript types (`z.infer<typeof schema>`).
- Prefer `type` for unions/intersections and simple aliases; use `interface` for object shapes that may be extended.
- Use `readonly` for data that should not be mutated after creation.
- Prefer `const` over `let`; never use `var`.

## React Components

- Use **functional components** exclusively; no class components.
- Use **named exports** for all components.
- Keep components small and focused on a single responsibility.
- Extract reusable logic into custom hooks (`use*.ts` files).
- Use **shadcn/ui** and **Radix UI** primitives before writing custom UI; extend them via Tailwind utility classes.
- Apply `React.memo` or `useMemo`/`useCallback` only when there is a measurable performance issue.
- Always provide accessible labels (ARIA attributes, `htmlFor`, etc.).

## Styling

- Use **Tailwind CSS** utility classes exclusively; avoid inline styles and CSS modules.
- Use `clsx` / `tailwind-merge` (`cn()` helper) to combine conditional class names.
- Follow the existing shadcn/ui component patterns in `src/renderer/components/ui/`.

## State Management

- Global/shared state belongs in **Zustand** stores (`src/renderer/state/`).
- Use **Immer** inside Zustand when mutating nested state.
- Local component state stays in `useState` / `useReducer`.
- Avoid prop drilling more than 2 levels deep – lift state or use a store.

## Electron IPC

- The **main process** (`src/main/`) handles file system, networking, and OS-level APIs.
- The **renderer process** (`src/renderer/`) must communicate with the main process exclusively through typed IPC channels exposed via the preload script.
- Define IPC channel types in `src/shim/` so both processes share the same contract.
- Never use `remote` module or `nodeIntegration: true`.
- Validate all data received via IPC using Zod before processing.

## Error Handling

- Use typed error classes (see `src/main/error/` and `src/renderer/error/`).
- Display user-facing errors via the toast notification system (`sonner`).
- Log errors in the main process using **Winston**; avoid `console.error` in production code.
- Always handle promise rejections – never leave `.catch()` empty.

## File & Folder Conventions

- Component files: `PascalCase.tsx` (e.g., `RequestBodyEditor.tsx`)
- Hook files: `camelCase.ts` prefixed with `use` (e.g., `useRequestState.ts`)
- Utility files: `camelCase.ts` (e.g., `formatHeaders.ts`)
- Test files: co-located as `*.test.ts` / `*.test.tsx` or inside `__tests__/`
- Place shared types between main and renderer in `src/shim/`

## Best Practices

- Do not commit commented-out code.
- Prefer explicit over clever – prioritise readability.
- Keep imports sorted and avoid wildcard imports (`import * as`).
- Format code with **Prettier** on save (configured in `.vscode/settings.json`).
