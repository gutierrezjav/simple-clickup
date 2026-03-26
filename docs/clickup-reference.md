# ClickUp Reference

Last updated: 2026-03-26

## Target

- Workspace ID: `2199933`
- List: `R&D WingtraCloud > All Tasks > Wingtra Cloud Dev`
- List ID: `901500224401`

## Status Model

### Not Started

- `BACKLOG`
- `BUGS / ISSUES`
- `IN UX DESIGN`
- `READY TO REFINE`
- `SPRINT READY`
- `BLOCKED`
- `SPRINT BACKLOG`

### Active

- `IN PROGRESS`
- `IN CODE REVIEW`
- `DEPLOYED TO DEV`
- `TESTED IN DEV`
- `DEPLOYED TO STAGING`
- `TESTED IN STAGING`

### Done

- `DEPLOYED TO PROD`
- `PROD MINOR ISSUE`

### Closed

- `CLOSED`

## Product Scope

- the planning view has been discontinued and is no longer part of the active app
- `/planning` now redirects to `/daily` for compatibility only
- all active behavior and verification rules below apply to the daily board

## Daily Columns

Use these exact columns in this order:

- `BLOCKED`
- `SPRINT BACKLOG`
- `IN PROGRESS`
- `IN CODE REVIEW`
- `DEPLOYED TO DEV`
- `TESTED IN DEV`
- `DEPLOYED TO STAGING`
- `TESTED IN STAGING`

## Item Classification

Preferred classification:

1. task type
2. parent/subtask hierarchy fallback

Observed task type IDs:

- `custom_item_id = 1005`: epic-like item
- `custom_item_id = 1004`: user-story-like parent item
- `custom_item_id = 1001`: bug-like standalone item

## Daily Board Behavior

- one row per story
- only user-story items create dedicated story swimlanes
- story itself is a row header, not a board card
- nested stories are rows, not cards
- only non-story children render as cards
- tasks with subtasks stay normal tasks, not story rows
- non-story descendants inherit the swimlane of their nearest non-story or story ancestor
- ancestor story rows remain visible when descendant active work exists
- one extra row for standalone tasks
- one extra row for standalone bugs
- daily filters are client-side only
- daily status columns keep the canonical status order
- daily status columns can be collapsed or expanded client-side from the header
- `SPRINT BACKLOG`, `IN PROGRESS`, and `IN CODE REVIEW` stay expanded by default even when empty
- collapsed status columns hide their cards until expanded again

## Daily Meeting Helper

- the daily page includes a frontend-only `Next` helper in the filter toolbar
- the helper uses the current assignee filter list as its source roster
- `Unassigned` and `Javier Gutierrez` are excluded from the helper rotation
- `Jessica Nilsson` is always moved to the end when she is present in the assignee list
- the first `Next` click starts a randomized order; later clicks keep advancing the stored order until it ends
- manual search changes, manual assignee changes, `Clear filters`, and `Refresh` do not reset the stored `Next` order
- if new people appear in the assignee list after a round starts, they are not injected into the current stored order; they can still be selected manually
- after the final speaker, the next `Next` click clears the assignee filter and resets the helper round

## Daily Board Design Guidelines

- use a flat sticky swimlane header surface with an opaque background
- do not let card shadows or scrolling content bleed through the swimlane header area
- keep story, task, and bug swimlane header treatment visually consistent unless there is a strong information-hierarchy reason not to
- keep daily cards compact: reduced padding, reduced gaps, smaller radii, and regular-weight titles
- collapsed columns should read as rails, not mini full columns
- collapsed rails keep the colored status chip at the top and the count at the bottom

## Important Fields

Fields observed on the target list:

- `Prio score`

Important implementation rule:

- observed fields are not automatically hard-required
- only fields used by the current normalization should block live reads

## Read Query Defaults

Daily:

- `include_closed=false`
- `include_timl=false`
- `subtasks=true`
- statuses:
  - `BLOCKED`
  - `SPRINT BACKLOG`
  - `IN PROGRESS`
  - `IN CODE REVIEW`
  - `DEPLOYED TO DEV`
  - `TESTED IN DEV`
  - `DEPLOYED TO STAGING`
  - `TESTED IN STAGING`

## Guardrails

- the frontend should not call ClickUp directly
- mock mode should remain the default safe mode
- writes are tracked separately in [clickup-write-project-plan.md](/data/simple-clickup/docs/clickup-write-project-plan.md)
