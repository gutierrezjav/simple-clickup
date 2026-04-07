# Daily Meeting Next-Name Helper Plan

## Summary

Add a frontend-only daily-meeting helper on the `/daily` page that drives the existing assignee filter.

Behavior:

- the helper uses the current assignee dropdown options as the source roster
- `Unassigned` is always excluded from the speaking order
- backend-configured excluded assignees are always excluded from the speaking order
- an optional backend-configured final speaker is moved to the end of the order only if they are already present in the roster
- the first click on `Next` starts a new round with a randomized order
- once a round has started, the `Next` button may show a subtle tooltip preview of the upcoming speaker using only their first name
- each later click advances to the next name in that stored order and updates the assignee filter to that person
- if the user manually selects a different assignee mid-round, that manual selection does not reset or rewrite the stored order; the next `Next` click resumes the original sequence from the stored position and overrides the manual selection
- after the final speaker, the next click clears the assignee filter and clears the round state
- state is page-only and resets on refresh

## Public Interfaces

- backend env config now supplies the helper's configurable exclusions and optional final speaker
- the `/daily` response now includes the helper config alongside the board rows
- no server persistence
- frontend-only state inside the daily page, with the sequencing logic extracted into a small pure helper module for testability

## Implementation Changes

### Rotation logic

- add a new frontend helper module that accepts the current assignee options and returns:
  - eligible roster
  - randomized round order
  - next-state transition for each `Next` click
- roster rules:
  - start from the existing assignee filter options
  - drop `Unassigned`
  - drop any backend-configured excluded assignees
  - if a backend-configured final speaker is present, remove them from the shuffled set and append them last
  - if the configured final speaker is absent, do not invent or append them
- round rules:
  - first `Next` click when no active round exists creates a fresh order and selects the first speaker
  - later `Next` clicks move to the next speaker in the stored order
  - manual assignee changes do not affect the stored order or pointer
  - after the last speaker, the next click clears selection and resets the round

### Daily page UI

- add a single `Next` button to the existing filter-toolbar actions area, next to `Clear filters`
- keep the UI minimal:
  - the assignee dropdown remains the visible source of truth for the currently shown person
  - no new panel or server-backed controls
- button behavior:
  - enabled only when there is at least one eligible assignee option after exclusions
  - first click starts the round
  - after the round starts, hover can preview the next speaker's first name
  - later clicks advance the stored sequence, even if the dropdown was manually changed in between
- if the only options are excluded names or the list is otherwise empty, disable `Next`

### State lifecycle

- store helper state in `DailyPage` component state:
  - current round order
  - current sequence index
  - active-round marker
- preserve the active round when the user manually changes the assignee dropdown
- reset the round state only when:
  - the daily data refresh changes the eligible assignee roster
  - the user clicks `Clear filters`
  - the round has fully ended and the final post-round `Next` clears selection
- if there is no active round and the user manually selects a person, the next `Next` click still starts a new randomized round from scratch

## Test Plan

- add pure unit tests for the sequencing helper:
  - excludes `Unassigned`
  - excludes backend-configured assignees
  - keeps the configured final speaker last when present
  - does not add the configured final speaker when absent
  - first `Next` starts a randomized round
  - repeated `Next` walks the stored order without reshuffling mid-round
  - manual assignee selection does not reset the round
  - next click after a manual selection resumes the stored order, not the manually chosen name
  - next click after the final speaker clears selection and resets the round
  - fully excluded or empty eligible roster disables or no-ops correctly

## Assumptions

- `Use the names in the filter list` means the current assignee dropdown options already shown on `/daily`
- `Unassigned` is never a speaker
- backend-configured excluded assignees are always excluded from helper-driven rotation, even if they appear in the filter list
- manual assignee changes are treated as temporary interruptions for viewing, not as edits to the stored speaking order
- the selected assignee filter is the current-speaker indicator shown by the page
- when the round ends, the next click clears the assignee filter rather than auto-starting a new round
