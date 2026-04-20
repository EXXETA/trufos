---
description: Analyse the Trufos codebase and generate a comprehensive architecture blueprint document
mode: agent
---

# Trufos Architecture Blueprint Generator

Generate a `docs/architecture-blueprint.md` document that thoroughly analyses the architectural patterns in the Trufos codebase. This document should serve as a definitive reference for maintaining architectural consistency.

## Analysis Steps

### 1. Project & Tech Stack Detection

Analyse:
- `package.json` for dependencies and versions
- `tsconfig.json` and `vite.config.ts` for build configuration
- `forge.config.ts` for Electron packaging setup
- Source folder structure: `src/main/`, `src/renderer/`, `src/shim/`

### 2. Architecture Overview

Document:
- Electron two-process model (main process vs. renderer process)
- Role of `src/shim/` as the shared contract layer
- IPC communication patterns (channel definitions, event handling, preload exposure)
- How the renderer bootstraps (entry point, routing, providers)

### 3. Architecture Diagram

Create a Mermaid component diagram showing:
- Main process components and their responsibilities
- Renderer process components (stores, services, UI layers)
- IPC channels connecting the two processes
- External dependencies (file system, network, OS APIs)

### 4. Core Architectural Components

For each layer, document:
- **Purpose** – what it owns and its boundaries
- **Internal structure** – key files, patterns, and abstractions
- **Interaction patterns** – how it communicates with other layers
- **Extension points** – how to add new functionality to this layer

Layers to cover:
- `src/main/event/` – IPC handler registration
- `src/main/network/` – HTTP request execution
- `src/main/persistence/` – Data storage
- `src/main/filesystem/` – File system operations
- `src/renderer/state/` – Zustand stores
- `src/renderer/services/` – IPC call wrappers
- `src/renderer/components/` – UI component hierarchy
- `src/shim/` – Shared types and Zod schemas

### 5. State Management Architecture

Document:
- Zustand store organisation and naming
- How Immer is used for immutable updates
- Relationship between stores and components
- Local vs. global state decision guidelines

### 6. Data Flow

Trace a complete request cycle:
1. User interaction in the renderer
2. Renderer service calls IPC via preload
3. Main process handler executes (network/file)
4. Result returned to renderer
5. Zustand store updated
6. UI re-renders

### 7. Cross-Cutting Concerns

Document:
- **Error handling** – typed errors, user-facing toasts, Winston logging
- **Validation** – Zod schemas, where validation occurs
- **Logging** – Winston in main process, renderer logging approach
- **Theming** – next-themes integration, dark/light mode

### 8. Testing Architecture

Document:
- Vitest configuration and test environment (jsdom)
- How Electron APIs are mocked in renderer tests
- How file system operations are mocked with memfs
- Testing patterns for IPC handlers

### 9. Blueprint for New Features

Provide a step-by-step guide for adding a new feature, covering:
1. Define shared types in `src/shim/`
2. Add Zod validation schemas
3. Implement main process IPC handler in `src/main/event/`
4. Create renderer service wrapper in `src/renderer/services/`
5. Add or extend Zustand store in `src/renderer/state/`
6. Build UI components in `src/renderer/components/`
7. Write tests for each layer

Include a checklist of common pitfalls (IPC type mismatches, missing preload exposure, unhandled promise rejections, missing error boundaries).

## Output

- **File:** `docs/architecture-blueprint.md`
- **Format:** Markdown with Mermaid diagrams
- Note the date of generation and recommend updating the document when architecture changes.
