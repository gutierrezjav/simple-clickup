# ClickUp Research

Last updated: 2026-03-10

## Purpose

This note compresses the current research for a simple ClickUp client scoped to a single main list, with:

- a planning view
- a daily view
- a controlled task/custom-field structure

The active project is now read-only. Mutation planning has been split into [clickup-write-project-plan.md](/data/simple-clickup/clickup-write-project-plan.md).

The research combines:

- live workspace inspection through ClickUp MCP
- public ClickUp API constraints
- user decisions made so far in chat

## Target workspace and list

- Workspace ID: `2199933`
- Main v1 list: `R&D WingtraCloud > All Tasks > Wingtra Cloud Dev`
- Main list ID: `901500224401`

This list is the current recommended target because it already contains the workflow shape we need:

- parent user stories
- subtasks for execution work
- standalone bugs/tasks
- planning-related fields
- daily-work statuses

## Live data model findings

### Task types currently in use

Observed from live tasks:

- `custom_item_id = 1005`: epic-like items in the separate `Epics` list
- `custom_item_id = 1004`: user-story-like parent items in the main list
- `custom_item_id = 1001`: bug-like standalone items in the main list

Recommended v1 classification rule:

1. Use ClickUp task type first.
2. Fall back to parent/subtask hierarchy if data is inconsistent.

### Hierarchy currently in use

Observed pattern in `Wingtra Cloud Dev`:

- epics live in a separate list
- stories live in the main list
- subtasks represent execution work under stories
- some bugs/tasks are standalone and do not belong to a story

Examples inspected:

- story with subtasks: `CL-6870` / `Metadata: basic ETL pipeline`
- story with subtasks: `CL-8143` / `Telemetry setting fixes`
- standalone bug-like item: `CL-7789` / `WingtraGround processing: unspecified antenna type`

## Relevant custom fields found on the target list

Fields already present and relevant to v1:

- `Prio score` (`number`)
- `Planning bucket` (`drop_down`)
- `Swimlane` (`drop_down`)
- `CL Sprint ID` (`short_text`)
- `Epic` (`drop_down`)
- `Epic-Story` (`list_relationship`)
- `Technical Area` (`drop_down`)
- `effort` (`drop_down`)
- `Size (days)` (`number`)

Other workflow-supporting fields also exist, including deployment dates and review/testing metadata, but they are not required for the first client cut.

### Existing option values observed

`Planning bucket`

- `done`
- `must deliver`
- `High`
- `Opportunistic`
- `Not planned`

`Swimlane`

- `New Features`
- `Tech debt`
- `Mixed`
- `Bugs`

## Public ClickUp API findings

### Relevant API areas

The v1 client will need:

- task listing and filtering
- task detail fetch
- task create/update
- custom field metadata fetch
- custom field value write/remove

If exact saved-view reproduction is ever needed, ClickUp also has view-related APIs, but the MCP toolset available in this environment does not expose saved private view definitions directly.

### Important API constraints

#### 1. Frontend should not call ClickUp directly

ClickUp documents CORS limitations for frontend requests. The web app should use a backend/server layer that talks to ClickUp on behalf of the UI.

#### 2. Custom field writes are a separate concern

Existing custom field values are not just part of normal task update payloads. The client/backend design should account for dedicated custom-field value update endpoints.

#### 3. Task types matter

The target list uses custom task types in practice, not just free-form custom fields and hierarchy. The app should preserve that model.

#### 4. Saved ClickUp views are only partially inspectable here

From MCP we can inspect:

- workspace hierarchy
- lists
- task types
- task fields
- sample tasks

From MCP we cannot directly inspect:

- the exact saved filter/group/sort config behind private ClickUp view URLs

That part still depends on screenshots or manual extraction from the ClickUp UI.

#### 5. Live read access is much safer than live write access

For this project, live reads from the production ClickUp list are acceptable in development as long as the backend includes guardrails such as:

- short-lived caching for repeated planning/daily loads
- request deduplication
- bounded refresh behavior instead of aggressive polling
- 429 / `Retry-After` handling

Live writes are a separate risk because they mutate the real planning workflow. They are no longer part of the active project roadmap and should be handled in the separate write project.

#### 6. Rate limits are per token and plan-dependent

From the current ClickUp rate-limit documentation:

- `Free Forever`, `Unlimited`, and `Business`: `100` requests per minute
- `Business Plus`: `1,000` requests per minute
- `Enterprise`: `10,000` requests per minute

The docs also state that `429` responses include:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

This means the backend should not rely on `429` as the first signal. It should maintain a local per-token request budget and still honor the upstream reset headers when ClickUp rate-limits anyway.

#### 7. List-task query shaping is the first optimization path

The list-task endpoint already supports the parameters this project needs for the next optimization slice:

- `statuses[]`
- `include_closed`
- `include_timl`
- `subtasks`

That makes it the right first step for both planning and daily optimization. The filtered team-task endpoint should remain a fallback only if list-task filtering proves too loose during validation.

## Product decisions already made

### Platform and architecture

- v1 is a web app
- local development comes first
- architecture should remain OAuth-capable
- data refresh should be manual on load, manual on demand, and after edits
- use a simple `Express` backend rather than `Next.js`
- `Fastify` is not needed for v1
- frontend development should be Storybook-first before full app integration

### Main scope

- single main list only
- ignore epics in v1
- update-only client in v1
- support light editing only
- require a Storybook verification phase before wiring the full app

### Read-only project policy

- use live production ClickUp for reads
- keep the active project read-only
- track mutation work separately in [clickup-write-project-plan.md](/data/simple-clickup/clickup-write-project-plan.md)

## Planning view definition

### Current chosen behavior

- one ranked backlog/list
- main items are user stories
- stories are collapsed by default
- expanding a story shows its non-closed subtasks
- parent stories are sorted by `Prio score`
- expanded subtasks are sorted by `Prio score`

### Screenshot-derived filter logic

Current intent is to mirror the ClickUp filter shown in the screenshot:

- `Task Type is User Story` AND `Status is not <7 excluded statuses>`
- OR `Task Type is Bug` AND `Tags is any of [po prio, qa prio]` AND `Status is not <7 excluded statuses>`
- OR `Status is SPRINT BACKLOG`

This exact logic is now preferred over the earlier broader interpretation.

### Excluded planning statuses

The excluded statuses are:

- `DEPLOYED TO DEV`
- `TESTED IN DEV`
- `DEPLOYED TO STAGING`
- `TESTED IN STAGING`
- `DEPLOYED TO PROD`
- `PROD MINOR ISSUE`
- `CLOSED`

### Planning read UX priority

Planning filters are no longer core scope. The required planning work is visual/read usability:

- denser list rows
- clearer chip hierarchy
- stronger assignee/avatar treatment
- more compact child rows

Planning filters are optional and last.

## Daily view definition

### Current chosen behavior

- board layout with exact ClickUp statuses as columns
- rows are user stories
- parent story is row header only, not a draggable/normal card
- nested stories are also row headers, not cards
- child tasks appear as cards inside status columns
- only non-story children become cards for a story row
- ancestor stories stay visible if any descendant execution work is still active on the board
- the next read-only slice adds client-side `search` and `assignee` filters
- the next read-only slice adds filtered totals for page, row, and column headers

### Standalone work handling

Standalone items should not appear as many individual rows.

Instead:

- one special row for standalone tasks
- one special row for standalone bugs

### Daily-active statuses provided so far

- `Blocked`
- `SPRINT BACKLOG`
- `In Progress`
- `In Review`
- `Deployed to Dev`
- `Tested in Dev`

If the actual ClickUp capitalization/spelling differs, the app should use the real status strings from the list configuration.

### Full status set confirmed from ClickUp

`Not started`

- `BACKLOG`
- `BUGS / ISSUES`
- `IN UX DESIGN`
- `READY TO REFINE`
- `SPRINT READY`
- `BLOCKED`
- `SPRINT BACKLOG`

`Active`

- `IN PROGRESS`
- `IN CODE REVIEW`
- `DEPLOYED TO DEV`
- `TESTED IN DEV`
- `DEPLOYED TO STAGING`
- `TESTED IN STAGING`

`Done`

- `DEPLOYED TO PROD`
- `PROD MINOR ISSUE`

`Closed`

- `CLOSED`

## Current implementation direction

### Proposed system shape

- browser SPA for planning and daily screens
- simple TypeScript `Express` backend for auth + API calls
- list-scoped data layer for `Wingtra Cloud Dev`
- normalized internal model for:
  - stories
  - subtasks
  - standalone tasks
  - standalone bugs

### Auth and session direction

- real ClickUp OAuth in v1
- no database in v1
- use ephemeral encrypted cookie session state
- if the app restarts or the session is lost, re-authentication is acceptable
- keep the backend simple; no `Fastify` migration in v1

### Frontend delivery sequence

- build reusable components and screen compositions in Storybook first
- review the planning and daily UI there with mocked data
- only after Storybook verification, wire the SPA to the real backend read flows

### Read optimization direction

- split live reads into separate `schema`, `planning`, and `daily` loaders
- stop using one broad shared task snapshot for all backend routes
- make `/api/clickup/schema` metadata-only
- keep the existing list-task endpoint as the first implementation path
- planning should request only:
  - `BACKLOG`
  - `BUGS / ISSUES`
  - `IN UX DESIGN`
  - `READY TO REFINE`
  - `SPRINT READY`
  - `BLOCKED`
  - `SPRINT BACKLOG`
  - `IN PROGRESS`
  - `IN CODE REVIEW`
- daily should request only:
  - `BLOCKED`
  - `SPRINT BACKLOG`
  - `IN PROGRESS`
  - `IN CODE REVIEW`
  - `DEPLOYED TO DEV`
  - `TESTED IN DEV`
- both planning and daily should use `include_closed=false`
- both planning and daily should use `include_timl=false` unless cross-listed tasks are explicitly required

### Observability direction

- use `pino` for structured one-line backend logs
- emit one log line per outbound ClickUp request with URL/path, start time, duration, response status, and item count
- emit one log line per logical backend read for `schema`, `planning`, and `daily`
- keep usage visibility backend-only for this slice

### Rate-limit direction

- fetch workspace plan once per token/team and map it to the documented per-minute request budget
- if plan lookup fails, fall back to `100 rpm` as the conservative default
- maintain a local per-token sliding 60-second request window
- start blocking locally at `90%` of the detected limit instead of waiting for upstream `429`
- on upstream `429`, honor `Retry-After` first and fall back to `X-RateLimit-Reset`

### Separate write project

Mutation modes and write-path safety are now tracked in [clickup-write-project-plan.md](/data/simple-clickup/clickup-write-project-plan.md).

### Normalized item handling

- use ClickUp task type as the primary classification signal
- use parent/subtask relationships as fallback
- do not make epic support a v1 feature

### Planning screen

- fetch relevant tasks from the target list
- apply planning filter logic
- rank by `Prio score`
- render stories collapsed by default
- render standalone bugs/tasks in the same planning list

### Daily screen

- fetch relevant tasks from the target list
- filter to the chosen daily-active statuses
- render status columns using the real ClickUp statuses
- render one row per story
- render one `Tasks` row and one `Bugs` row for standalone work
- add client-side `search` and `assignee` filters
- add filtered totals for page, row, and column headers
