# ClickUp Client Read Project Plan

Last updated: 2026-03-20

## Goal

Maintain a read-only ClickUp client for the `Wingtra Cloud Dev` list with:

- a planning view
- a daily board view
- backend-owned ClickUp access
- optional live auth via OAuth

The active project remains read-only. All write work stays in [clickup-write-project-plan.md](/data/simple-clickup/docs/clickup-write-project-plan.md).

## Current Phase

Status: complete

The active read-only roadmap is complete. Optional planning filters remain deferred and are not required for closure.

### Phase 1: Read-Only Foundation

Status: done

Completed:

- removed write-mode concepts from the read UI contract
- shipped planning and daily screens
- implemented backend schema/planning/daily live loaders
- implemented OAuth session flow
- added caching, deduplication, and rate-limit handling
- shipped daily filters, counts, and layout refinements

### Phase 2: Live Verification And Targeted Polish

Status: done

Completed:

- verified planning output against the real ClickUp prio view
- verified daily output against the real ClickUp daily view
- corrected the planning field mapping to use `Budget` with legacy compatibility for `Planning bucket`
- aligned verification metrics so top-level planning counts match the prio view contract
- kept `/verify` available as a hidden session-backed verification route

### Phase 3: Optional Planning Filters

Status: deferred

Only do this after phase 2 is stable.

## In Scope

- server-side ClickUp reads
- planning and daily normalization
- route-level loading and error handling
- Storybook-backed UI development
- read-only visual polish

## Out Of Scope

- production writes
- write-mode UI
- optimistic mutation flows
- backend filter params for planning or daily unless live verification proves they are necessary

## Working Rules

- keep ClickUp access in the backend
- keep mock mode safe by default
- keep live-read logic split into `schema`, `planning`, and `daily`
- only hard-require ClickUp fields that are actually needed by current normalization
- keep the write roadmap separate

## Design Guidelines

- keep the daily board visually dense: compact cards, smaller spacing, and reduced corner radius
- keep daily card titles regular-weight for fast scanning; avoid bold-heavy card typography
- keep swimlane headers sticky and fully opaque so scrolling content and card shadows never bleed through
- keep swimlane headers visually flat; avoid border, shadow, blur, or other depth effects unless they solve a clear usability issue
- keep the canonical daily status order even when columns are collapsed or expanded client-side
- collapsed columns should behave as compact rails: status chip at the top, count at the bottom, and no visible cards while collapsed

## Exit Criteria For Phase 2

- planning and daily views are trustworthy against the real ClickUp list
- no known hierarchy or count mismatches remain
- the current visual pass is either accepted or reduced to a short targeted follow-up list

Status: met and project closed

## Main Entry Points

- [implementation-status.md](/data/simple-clickup/docs/implementation-status.md)
- [clickup-reference.md](/data/simple-clickup/docs/clickup-reference.md)
- [backend/src/clickup/service.ts](/data/simple-clickup/backend/src/clickup/service.ts)
- [frontend/src/routes/planning-page.tsx](/data/simple-clickup/frontend/src/routes/planning-page.tsx)
- [frontend/src/routes/daily-page.tsx](/data/simple-clickup/frontend/src/routes/daily-page.tsx)
