# ClickUp Client Read Project Plan

Last updated: 2026-03-18

## Goal

Maintain a read-only ClickUp client for the `Wingtra Cloud Dev` list with:

- a planning view
- a daily board view
- backend-owned ClickUp access
- optional live auth via OAuth

The active project remains read-only. All write work stays in [clickup-write-project-plan.md](/data/simple-clickup/docs/clickup-write-project-plan.md).

## Current Phase

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

Status: active

Focus:

- verify planning and daily output against real ClickUp data
- correct concrete mismatches in counts, hierarchy handling, or filtering
- make only targeted visual adjustments that are justified by live usage

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

## Exit Criteria For The Active Phase

- planning and daily views are trustworthy against the real ClickUp list
- no known hierarchy or count mismatches remain
- the current visual pass is either accepted or reduced to a short targeted follow-up list

## Main Entry Points

- [implementation-status.md](/data/simple-clickup/docs/implementation-status.md)
- [clickup-reference.md](/data/simple-clickup/docs/clickup-reference.md)
- [backend/src/clickup/service.ts](/data/simple-clickup/backend/src/clickup/service.ts)
- [frontend/src/routes/planning-page.tsx](/data/simple-clickup/frontend/src/routes/planning-page.tsx)
- [frontend/src/routes/daily-page.tsx](/data/simple-clickup/frontend/src/routes/daily-page.tsx)
