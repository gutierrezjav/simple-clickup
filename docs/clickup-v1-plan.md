# ClickUp Client Read Project Plan

Last updated: 2026-03-25

## Goal

Maintain a read-only ClickUp client for the `Wingtra Cloud Dev` list with:

- a daily board view
- backend-owned ClickUp access
- OAuth-backed session auth

The active project remains read-only. All write work stays in [clickup-write-project-plan.md](/data/simple-clickup/docs/clickup-write-project-plan.md).

## Current Phase

Status: complete

The active read-only roadmap is complete. The old planning view has been discontinued and is no longer planned.

### Phase 1: Read-Only Foundation

Status: done

Completed:

- removed write-mode concepts from the read UI contract
- shipped the daily screen
- implemented backend daily and verification loaders
- implemented OAuth session flow
- added caching, deduplication, and rate-limit handling
- shipped daily filters, counts, and layout refinements
- removed the planning surface, Storybook surface, and alternate runtime mode paths that were no longer part of the shipped product

### Phase 2: Live Verification And Targeted Polish

Status: done

Completed:

- verified daily output against the real ClickUp daily view
- kept `/verify` available as a hidden session-backed verification route

### Planning Status

Status: discontinued

The planning view, planning loader, and planning-specific UI work were intentionally removed. Do not restart planning work unless the product scope changes explicitly.

## In Scope

- server-side ClickUp reads
- daily normalization
- route-level loading and error handling
- read-only visual polish

## Out Of Scope

- production writes
- write-mode UI
- optimistic mutation flows
- resurrecting the discontinued planning view without an explicit product decision
- backend filter params for daily unless live verification proves they are necessary

## Working Rules

- keep ClickUp access in the backend
- keep the runtime simple and single-path
- keep active backend reads focused on daily data, discrepancy checks, and verification summaries
- only hard-require ClickUp fields that are actually needed by current normalization
- keep the write roadmap separate

## Design Guidelines

- keep the daily board visually dense: compact cards, smaller spacing, and reduced corner radius
- keep daily card titles regular-weight for fast scanning; avoid bold-heavy card typography
- keep swimlane headers sticky and fully opaque so scrolling content and card shadows never bleed through
- keep swimlane headers visually flat; avoid border, shadow, blur, or other depth effects unless they solve a clear usability issue
- keep the canonical daily status order even when columns are collapsed or expanded client-side
- keep `SPRINT BACKLOG`, `IN PROGRESS`, and `IN CODE REVIEW` expanded by default even when empty; manual collapse still stays available
- collapsed columns should behave as compact rails: status chip at the top, count at the bottom, and no visible cards while collapsed

## Exit Criteria For Phase 2

- the daily view is trustworthy against the real ClickUp list
- no known hierarchy or count mismatches remain
- the current visual pass is either accepted or reduced to a short targeted follow-up list

Status: met and project closed

## Main Entry Points

- [implementation-status.md](/data/simple-clickup/docs/implementation-status.md)
- [clickup-reference.md](/data/simple-clickup/docs/clickup-reference.md)
- [backend/src/clickup/service.ts](/data/simple-clickup/backend/src/clickup/service.ts)
- [frontend/src/routes/daily-page.tsx](/data/simple-clickup/frontend/src/routes/daily-page.tsx)
