# ClickUp V1 Reference

Last updated: 2026-03-10

## Target list

- Workspace: `2199933`
- List: `R&D WingtraCloud > All Tasks > Wingtra Cloud Dev`
- List ID: `901500224401`

## Status model

### Not started

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

## Planning filter

Include:

- `Task Type = User Story` and status not in:
  - `DEPLOYED TO DEV`
  - `TESTED IN DEV`
  - `DEPLOYED TO STAGING`
  - `TESTED IN STAGING`
  - `DEPLOYED TO PROD`
  - `PROD MINOR ISSUE`
  - `CLOSED`
- OR `Task Type = Bug` with tag `po prio` or `qa prio` and status not in the same excluded set
- OR `Status = SPRINT BACKLOG`

## Daily board columns

Use these exact columns:

- `BLOCKED`
- `SPRINT BACKLOG`
- `IN PROGRESS`
- `IN CODE REVIEW`
- `DEPLOYED TO DEV`
- `TESTED IN DEV`

## Item model

- `custom_item_id = 1005`: epic-like item
- `custom_item_id = 1004`: user-story-like parent item
- `custom_item_id = 1001`: bug-like standalone item

Preferred classification:

1. task type
2. parent/subtask hierarchy fallback

## Relevant fields

- `Prio score`
- `Planning bucket`
- `Swimlane`
- `CL Sprint ID`
- `Epic`
- `Epic-Story`
- `Technical Area`
- `effort`
- `Size (days)`

## Inline editable planning fields

- `Prio score`
- assignee
- `Planning bucket`

## Daily behavior

- one row per story
- story is row header only
- nested stories are also rows, not cards
- child tasks are board cards
- only non-story children render as board cards for a story row
- ancestor story rows remain visible if any descendant task is active on the board
- one extra row for standalone tasks
- one extra row for standalone bugs
- drag-and-drop updates status only

## Storybook requirement

- build planning and daily UI components in Storybook before full app integration
- use mocked normalized data in Storybook
- use mocked write handlers in Storybook
- Storybook review is a verification phase, not an optional extra

## API constraints

- frontend should not call ClickUp directly
- browser UI should use a simple server-side `Express` ClickUp proxy
- custom field writes require dedicated custom-field update endpoints
- real OAuth is in scope for v1
- v1 session storage is ephemeral and cookie-based
- `Fastify` is not needed for v1

## ClickUp safety rules

- live production reads are allowed
- live production writes are not part of normal development/testing in v1
- default write mode is `mock`
- optional real-write mode may target a dedicated test ClickUp space/list only
- production-list live writes stay blocked until verification safeguards exist

## Read guardrails

- short-lived caching for planning/daily responses
- request deduplication for concurrent identical fetches
- bounded refresh only, no aggressive polling
- 429 handling with backoff and `Retry-After`

## Planning read query defaults

- `include_closed=false`
- `include_timl=false`
- `subtasks=true`
- explicit statuses:
  - `BACKLOG`
  - `BUGS / ISSUES`
  - `IN UX DESIGN`
  - `READY TO REFINE`
  - `SPRINT READY`
  - `BLOCKED`
  - `SPRINT BACKLOG`
  - `IN PROGRESS`
  - `IN CODE REVIEW`

## Daily read query defaults

- `include_closed=false`
- `include_timl=false`
- `subtasks=true`
- explicit statuses:
  - `BLOCKED`
  - `SPRINT BACKLOG`
  - `IN PROGRESS`
  - `IN CODE REVIEW`
  - `DEPLOYED TO DEV`
  - `TESTED IN DEV`

## Logging target

- use backend `pino` logging
- one line per outbound ClickUp request
- include URL/path, start time, duration, status, and item count
- never log tokens, cookies, or auth headers

## Rate-limit defaults

- rate limits are per token and depend on workspace plan
- default conservative fallback is `100 rpm` if workspace-plan lookup fails
- keep a local per-token sliding 60-second budget
- start blocking locally at `90%` of the detected limit
- continue honoring upstream `Retry-After` and `X-RateLimit-*` headers
