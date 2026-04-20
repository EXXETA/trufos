---
agent: agent
description: Generate a comprehensive Product Requirements Document (PRD) for a new Trufos feature
---

# Generate a Product Requirements Document (PRD)

## Goal

Create a detailed PRD in Markdown format based on an initial feature description. The PRD must be clear and actionable enough for a developer to implement the feature without further clarification.

## Process

1. **Receive feature description** from the user.
2. **Ask clarifying questions** to gather sufficient detail. Offer numbered/lettered choices where possible so the user can respond quickly.
3. **Generate the PRD** using the structure below.
4. **Save the PRD** as `tasks/prd-<feature-name>.md`.

## Clarifying Questions to Consider

Adapt these to the specific request:

- **Problem/Goal:** What problem does this feature solve?
- **Target user:** Who is the primary user?
- **Core actions:** What should the user be able to do?
- **User stories:** Can you provide 2–3 user stories?
- **Acceptance criteria:** How do we know the feature is done?
- **Scope/non-goals:** What should this feature explicitly *not* do?
- **Data / IPC:** Does this require new IPC channels or data persistence?
- **UI:** Are there design mockups or existing components to follow?
- **Edge cases:** What error conditions should be handled?

## PRD Structure

```markdown
# PRD: <Feature Name>

## Overview
Brief description of the feature and the problem it solves.

## Goals
- Measurable objective 1
- Measurable objective 2

## User Stories
- As a <user>, I want to <action> so that <benefit>.

## Functional Requirements
1. The system must …
2. The system must …

## Non-Goals (Out of Scope)
- …

## Design Considerations
Link to mockups or describe UI/UX requirements.
Reference existing shadcn/ui components where applicable.

## Technical Considerations
- IPC channels required
- State management approach (Zustand store vs. local state)
- New Zod schemas needed
- Dependencies on existing services

## Success Metrics
How will success be measured?

## Open Questions
- …
```

## Output

Present the completed PRD **in the chat** using the structure above. Do NOT create any files.

Once the user approves the PRD, create a **GitHub Issue** with:
- **Title:** `[PRD] <Feature Name>`
- **Body:** the full PRD content
- **Labels:** `enhancement` (add `needs-refinement` if open questions remain)

## Final Instructions

1. Do NOT start implementing the PRD.
2. Do NOT create any files in the repository.
3. Ask the user clarifying questions before writing the PRD.
4. Incorporate the user's answers, then present the PRD in the chat for approval.
5. Only after explicit approval: create the GitHub Issue.
