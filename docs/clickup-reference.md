# ClickUp Reference

Last updated: 2026-03-20

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

## Planning Inclusion Rules

Include:

- stories whose status is not in the excluded deployment or closed statuses
- standalone bugs with tag `po prio` or `qa prio` whose status is not in the excluded deployment or closed statuses
- any item in `SPRINT BACKLOG`

Excluded planning statuses:

- `DEPLOYED TO DEV`
- `TESTED IN DEV`
- `DEPLOYED TO STAGING`
- `TESTED IN STAGING`
- `DEPLOYED TO PROD`
- `PROD MINOR ISSUE`
- `CLOSED`

Verification notes:

- compare planning counts against the ClickUp prio view using top-level included items only
- do not include subtasks in top-level planning totals or missing budget counts
- `Budget` is the current field name; older `Planning bucket` naming is legacy compatibility only

## Daily Columns

Use these exact columns in this order:

- `BLOCKED`
- `SPRINT BACKLOG`
- `IN PROGRESS`
- `IN CODE REVIEW`
- `DEPLOYED TO DEV`
- `TESTED IN DEV`

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
- collapsed status columns hide their cards until expanded again

## Important Fields

Fields observed on the target list:

- `Prio score`
- `Budget`
- `CL Sprint ID`
- `Epic`
- `Epic-Story`
- `Technical Area`
- `effort`
- `Size (days)`

Important implementation rule:

- observed fields are not automatically hard-required
- only fields used by the current normalization should block live reads

## Read Query Defaults

Planning:

- `include_closed=false`
- `include_timl=false`
- `subtasks=true`
- statuses:
  - `BACKLOG`
  - `BUGS / ISSUES`
  - `IN UX DESIGN`
  - `READY TO REFINE`
  - `SPRINT READY`
  - `BLOCKED`
  - `SPRINT BACKLOG`
  - `IN PROGRESS`
  - `IN CODE REVIEW`

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

## Guardrails

- the frontend should not call ClickUp directly
- mock mode should remain the default safe mode
- writes are tracked separately in [clickup-write-project-plan.md](/data/simple-clickup/docs/clickup-write-project-plan.md)
