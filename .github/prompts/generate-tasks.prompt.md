---
mode: agent
description: Generate a detailed, phased task list from a Trufos PRD
---

# Generate a Task List from a PRD

## Goal

Create a detailed, step-by-step task list in Markdown format from an existing PRD file. The task list guides a developer through implementation in clearly defined phases.

## Role

You are a senior development planner. Think carefully about edge cases, IPC boundaries, and architectural decisions before producing the plan.

## Considerations

- Always begin with context gathering (read the codebase before planning implementation).
- Use phased development: setup → core logic → UI → testing → polish.
- Consider Electron's main/renderer split – IPC changes affect both sides.
- Scale complexity of planning to the size of the feature.
- If any requirement is unclear, ask for clarification before proceeding.
- This planning step occurs **before writing any code**.

## Context Gathering (if codebase exists)

1. Read all relevant source files in `src/main/`, `src/renderer/`, and `src/shim/`.
2. Examine `README.md`, `CONTRIBUTING.md`, and `docs/`.
3. Identify existing patterns and conventions (IPC handlers, Zustand stores, component structure).
4. Review relevant tests to understand expected behaviour.

## Output

Present the complete development plan **in the chat** using the structure below. Do NOT create any files.

Once the user approves the plan, add it as a **comment on the related GitHub Issue** so the task list lives alongside the issue.

### Plan Structure (present in chat)

```markdown
# Development Plan: <Feature Name>

## Project Purpose and Goals
<summary from PRD>

## Context and Background
<relevant codebase context>

## Relevant Files
- **path/to/file.ts** – description of role and why it's affected

## Development Phases

### Phase 1: Setup & Types
- [ ] 1.0 Define shared IPC types in `src/shim/`
  - [ ] 1.1 Add channel type definitions
  - [ ] 1.2 Add Zod schemas for validation

### Phase 2: Main Process
- [ ] 2.0 Implement IPC handler
  - [ ] 2.1 Register handler in `src/main/event/`
  - [ ] 2.2 Add business logic / file system operations

### Phase 3: Renderer
- [ ] 3.0 Add Zustand store (if needed)
- [ ] 4.0 Build UI components
  - [ ] 4.1 Create component file
  - [ ] 4.2 Wire up to store and IPC service

### Phase 4: Testing
- [ ] 5.0 Write unit tests for new utilities
- [ ] 6.0 Write component tests

## QA Checklist
- [ ] All PRD requirements implemented
- [ ] IPC channel types defined in shim
- [ ] Zod validation added for IPC payloads
- [ ] Unit and component tests written and passing (`yarn test`)
- [ ] Code linted (`yarn lint`) and formatted (`yarn prettier-check`)
- [ ] No `any` types introduced
- [ ] Error states handled and surfaced to the user
- [ ] Documentation updated if applicable
```

Then stop and wait for user review. Do NOT create any files.
After user approval, post the plan as a comment on the linked GitHub Issue.
