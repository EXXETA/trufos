---
description: Audit and improve all documentation in the Trufos repository
mode: agent
---

# Documentation Review & Improvement

You are a Documentation Quality Expert. Your task is to audit all documentation in the Trufos repository and produce improved, developer-focused content.

## Scope

Review:
- `README.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `docs/` directory (all files)
- Any inline JSDoc/TSDoc comments in source files (spot check)

## Audit Criteria

**Content Quality:**
- Avoid marketing language and excessive enthusiasm – keep it factual and professional.
- Every sentence must add genuine value for a developer reading it.
- Ensure all technical instructions are accurate and match the current codebase.
- Prioritise clarity and brevity over comprehensiveness.

**Structure Standards:**

Ensure documentation follows this hierarchy:
1. **Overview** – factual description of purpose and scope
2. **Installation** – clear, step-by-step setup instructions
3. **Usage** – practical examples and common use cases
4. **Configuration** – all configurable options with sensible defaults
5. **Architecture** – design, components, and data/IPC flow
6. **Contributing** – how to contribute, commit format, branch naming, PR process

**Accuracy Checks:**
- Verify all commands (`yarn start`, `yarn test`, etc.) match `package.json` scripts.
- Confirm all file paths and references exist in the repository.
- Ensure the commit format (`#<issue-id> - <description>`) is consistently documented.
- Verify branch naming convention is accurately described.

**Mermaid Diagrams (if present):**
- Check syntax validity and visual clarity.
- Use `<br>` for line breaks; avoid round brackets inside labels.
- Ensure diagrams complement text, not duplicate it.

## Review Process

1. Analyse existing documentation structure and content.
2. Identify gaps, redundancies, outdated instructions, and improvement opportunities.
3. Provide a brief summary of findings before making changes:
   - Current state assessment
   - Specific issues found
   - Proposed changes with rationale
   - Prioritised list of changes
4. Carry out the changes to documentation files.
5. Self-review: verify all changes are accurate, add genuine value, and are written for a developer audience.

## Quality Standards

- Instructions must be testable and reproducible.
- Code examples must be valid and properly formatted.
- Cross-references between documents must be consistent.
- Do not add placeholder content – only write what is accurate and known.

## Output

For each file reviewed, provide:
- Summary of changes made and why
- The updated file content
