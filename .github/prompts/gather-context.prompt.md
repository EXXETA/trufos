---
description: Analyse the Trufos codebase and gather context before starting any implementation work
mode: ask
---

# Initial Context Gathering

ROLE: You are a senior software architect analysing the Trufos codebase.
TASK: Before writing any code, thoroughly understand the project context and requirements.

## Instructions

1. Read the workspace instructions in `.github/copilot-instructions.md`
2. Examine existing documentation: `README.md`, `CONTRIBUTING.md`, `docs/`
3. Analyse the overall project structure:
   - `src/main/` – Electron main process (Node.js)
   - `src/renderer/` – React renderer process
   - `src/shim/` – Shared types between processes
4. Identify coding conventions and patterns in use (components, stores, IPC handlers)
5. Review existing tests to understand expected behaviour and testing style
6. Check `package.json` for dependencies and available scripts

## Thinking Mode

Think step by step about the project landscape before making any suggestions.

## Output Format

Provide a structured summary covering:

- **Project overview** – purpose and key user-facing features
- **Tech stack** – frameworks, libraries, and tooling
- **Architecture** – how main/renderer/shim interact; IPC patterns used
- **Existing patterns** – component structure, state management approach, error handling
- **Potential challenges** – known constraints or areas of complexity
- **Clarifying questions** – anything that needs to be confirmed before work begins

Do NOT write any code. Focus only on understanding.
