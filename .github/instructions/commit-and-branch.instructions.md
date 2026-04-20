---
applyTo: '*'
description: Commit message and branch naming conventions for the Trufos project
---

# Commit and Branch Conventions

## Commit Messages

All commit messages must reference the associated GitHub issue and be written in **English present tense**.

**Format:**
```
#<issue-id> - <short description>
```

**Rules:**
- Start with the issue reference `#<issue-id>` (mandatory).
- Use present tense and imperative mood: "add feature", not "added feature".
- Keep the first line under 72 characters.
- Optionally add a blank line followed by a longer body explaining *why* the change was made.
- Do not end the subject line with a period.

**Examples:**
```
#42 - add JSON body editor to request panel
#17 - fix crash when opening empty collection
#99 - refactor IPC handler for environment variables
```

## Branch Naming

**Format:**
```
<type>/<issue-id>-<short-description>
```

**Types:**
- `feature` – new functionality
- `fix` – bug fixes
- `tmp` – temporary / experimental branches

**Rules:**
- Use lowercase only.
- Separate words with hyphens (`-`).
- Keep it concise but descriptive.

**Examples:**
```
feature/42-json-body-editor
fix/17-crash-on-empty-collection
tmp/99-ipc-refactor-experiment
```

## Best Practices

- One commit = one logical change.
- Rebase your branch onto `main` before opening a PR.
- Always create or reference a GitHub issue before starting work.
- Use merge commits when merging into `main` (no fast-forward merges).
