---
agent: agent
description: Prepare and create a GitHub Pull Request for the current branch in EXXETA/trufos
tools: ['codebase', 'editFiles', 'runCommands', 'githubRepo']
---

# Create Pull Request

## Goal

Verify the current branch is ready for review and open a well-structured Pull Request on `EXXETA/trufos` that correctly fills in the PR template.

## Input

Issue number: `${input:issueNumber:GitHub issue number this PR resolves (e.g. 42)}`

## Process

### Step 1 – Verify Branch State

1. Confirm the working tree is clean (`git status`).
2. Check the current branch name matches the convention `<type>/<issue-id>-<short-description>`.
   - If not, rename the branch: `git branch -m <correct-name>`
3. Ensure all commits follow Conventional Commits (`<type>: <description>`).
   - List recent commits: `git log --oneline main..HEAD`
   - If the commit message is wrong, amend it: `git commit --amend`

### Step 2 – Run Quality Checks

Run all checks and **fix any failures before continuing**:

```bash
yarn test
yarn lint
yarn prettier-check
```

If `prettier-check` fails, auto-fix and re-commit:

```bash
yarn prettier
git add .
git commit -m "chore: fix formatting"
```

### Step 3 – Push the Branch

Push the branch to the remote (force-with-lease is safe after amends):

```bash
git push --set-upstream origin HEAD
# or after an amend:
git push --force-with-lease
```

### Step 4 – Gather PR Content

Collect the information needed to fill in the PR template:

1. **Changes summary** – read `git diff main..HEAD --stat` and the commit messages to summarise what changed.
2. **Linked issue** – fetch issue `#${input:issueNumber}` from `EXXETA/trufos` to confirm title and acceptance criteria.
3. **Testing notes** – check whether new or updated tests exist; note any manual testing that was performed.

### Step 5 – Compose the PR Body

Use the project's PR template (`.github/pull_request_template.md`) and fill every section:

```markdown
## Changes

<Concise bullet list of what was changed and why – derived from commit messages and diff>

## Testing

<Describe automated tests added/updated. Note any manual testing steps performed.
Include screenshots if UI was changed.>

## Checklist

- [x] Issue has been linked to this PR
- [ ] Code has been reviewed by person creating the PR
- [x] Automated tests have been written, if possible
- [x] Manual testing has been performed
- [ ] Documentation has been updated, if necessary
- [ ] Changes have been reviewed by second person
```

Rules:

- Mark checklist items `[x]` only when they are actually done.
- Keep the Changes section factual – no marketing language.
- If screenshots are relevant (UI changes), note where they should be added.

### Step 6 – Create the Pull Request

Create the PR targeting `main` with:

- **Title:** `<type>: <short description>` matching the main commit (Conventional Commits)
- **Body:** the composed template from Step 5
- **Base branch:** `main`
- **Labels:** apply `enhancement` for features, `bug` for fixes (match the linked issue labels)
- **Linked issue:** reference `Closes #${input:issueNumber}` at the end of the PR body so GitHub auto-closes the issue on merge

Append to the PR body (after the checklist):

```markdown
Closes #${input:issueNumber}
```

## Quality Checklist

Before submitting the PR, verify:

- [ ] Branch name follows `<type>/<issue-id>-<short-description>`
- [ ] All commits follow Conventional Commits (`<type>: <description>`)
- [ ] `yarn test` passes
- [ ] `yarn lint` passes
- [ ] `yarn prettier-check` passes
- [ ] PR title follows Conventional Commits (`<type>: <description>`)
- [ ] All PR template sections are filled in
- [ ] Issue is linked (`Closes #${input:issueNumber}`)
- [ ] Correct labels applied
