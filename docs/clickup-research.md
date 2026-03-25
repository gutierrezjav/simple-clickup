# ClickUp Research Notes

Last updated: 2026-03-25

## Purpose

This file keeps only the historical findings that still help explain the current implementation. The planning view has been discontinued, so planning-specific notes here should be treated as background only.

Use [clickup-reference.md](/data/simple-clickup/docs/clickup-reference.md) for stable product rules and [clickup-v1-plan.md](/data/simple-clickup/docs/clickup-v1-plan.md) for the active roadmap.

## Workspace Observations

- target workspace: `2199933`
- target list: `Wingtra Cloud Dev` (`901500224401`)
- epics live outside the main list
- stories live in the main list
- subtasks are the execution units under stories
- standalone bugs and tasks also exist in the main list

## Data Model Findings

- task type is the preferred classifier
- hierarchy is the fallback when task type data is incomplete
- `Prio score` is actively used by the current daily read model
- `Budget` was used by the discontinued planning model
- the older `Swimlane` field naming appears to have been replaced by `Budget`

Observed task type IDs:

- `1005`: epic-like
- `1004`: story-like
- `1001`: bug-like

Observed field examples:

- `Budget`: `done`, `must deliver`, `High`, `Opportunistic`, `Not planned`

## API Decisions That Still Matter

- ClickUp access stays in the backend because frontend-direct access is the wrong shape for this app
- list-task queries with explicit status filters are the first optimization path
- custom-field mutations are a separate concern and belong to the write project
- saved view definitions are not directly available here, so live UI verification still matters
- the session-backed `/verify` route is useful for spot checks, but it should not be primary navigation

## What Was Trimmed

The older file contained exploratory notes, duplicated roadmap text, and speculative next steps. That detail was removed once the read-only architecture was implemented.
