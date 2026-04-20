---
mode: agent
description: Step-by-step protocol for working through a Trufos task list
---

# Task List Processing Protocol

Guidelines for implementing tasks from a `tasks/tasks-prd-*.md` file.

## Implementation Rules

- **One sub-task at a time.** Do NOT start the next sub-task until the user explicitly approves ("yes" / "y").
- Before starting work, identify which sub-task is next (first unchecked `[ ]`).

## Completion Protocol

When a **sub-task** is finished:
1. Mark it complete: change `[ ]` to `[x]` in the task list file.
2. Update the **Relevant Files** section with any new or modified files.

When **all sub-tasks** under a parent task are `[x]`:
1. Run the full test suite: `yarn test`
2. Only if all tests pass: stage changes with `git add .`
3. Remove any temporary files or debug code.
4. Commit using the project's commit format:
   ```
   git commit -m "#<issue-id> - <description of what was accomplished>"
   ```
5. Mark the parent task `[x]`.

After each sub-task, **stop and wait** for user approval before continuing.

## Task List Maintenance

- Keep the task list file up to date as work progresses.
- Add newly discovered sub-tasks as they emerge.
- Mark blocked items and document the reason.
- Keep the **Relevant Files** section accurate at all times.

## AI Behaviour

When working through a task list, you must:

1. Read the task list file at the start of each session to determine where to resume.
2. Confirm the next sub-task with the user before starting.
3. After completing a sub-task: update the file, then pause for user approval.
4. Follow the commit protocol before marking a parent task done.
5. Never skip ahead or batch multiple sub-tasks without user consent.
