# Sprint Planning Design

Date: 2026-06-08

## Context

Simple ClickUp is currently a read-only ClickUp client for the Wingtra Cloud Dev
list. The app has a visible Daily page and a hidden Verification page. The new
Sprint Planning tab should recreate the useful part of this ClickUp view:

https://app.clickup.com/2199933/v/l/234bx-100375

The planning tab must preserve the view's filter scope, but calculate estimate,
tracked time, and remaining time itself because the ClickUp `Time (remaining)`
formula is not reliable for parent plus subtask rollups.

## Goals

- Add a visible Sprint Planning tab in Simple ClickUp.
- Use ClickUp view `234bx-100375` as the source of truth for which tasks appear.
- Support any sprint labels returned by the view, including `W22`, `W24`,
  `W24 - CURRENT`, `W25`, `W26`, and future sprint options.
- Never depend on the ` - CURRENT` suffix for filtering, sorting, or grouping.
- Roll up time from each visible parent task and its subtasks.
- Show accurate estimate, tracked, remaining hours, and remaining days.
- Show totals per sprint and all-up totals.
- Sort by sprint week number oldest first, then by ascending `Prio score`.
- Keep the feature read-only.

## Non-Goals

- Editing ClickUp tasks, estimates, sprint fields, statuses, or priorities.
- Recreating all ClickUp view controls.
- Hard-coding a current sprint label.
- Using full-text search, tags, or the ` - CURRENT` suffix to infer sprint scope.

## Architecture

The backend owns all ClickUp reads, matching the existing app model. It will add
a planning read service method and a `/api/clickup/planning` route. The frontend
will add a `/planning` route and a top navigation tab.

The planning service will call ClickUp's view endpoints through the existing
OAuth-backed `ClickUpClient`. ClickUp documents `GET /view/{view_id}` for view
metadata and `GET /view/{view_id}/task` for tasks visible in a view. The app
will use visible view tasks as membership truth, then fetch task details when
needed to calculate descendant rollups.

## Data Flow

1. Frontend loads `/api/clickup/planning`.
2. Backend fetches all pages of `GET /view/234bx-100375/task`.
3. Backend removes rows that are subtasks of another returned task when building
   top-level report rows, to avoid double-counting.
4. Backend fetches full task details with subtasks for each visible parent row
   if the view task payload does not include complete descendants.
5. Backend extracts the `Sprint` custom field from each row.
6. Backend maps dropdown values to option labels using the task's custom field
   type config and list custom-field metadata.
7. Backend calculates rollup metrics:
   - `estimateMs = sum(time_estimate || 0)` for parent plus descendants.
   - `trackedMs = sum(time_spent || 0)` for parent plus descendants.
   - `remainingMs = estimateMs - trackedMs`.
   - `estimateHours = estimateMs / 3_600_000`.
   - `trackedHours = trackedMs / 3_600_000`.
   - `remainingHours = remainingMs / 3_600_000`.
   - `remainingDays = remainingHours / 8`.
8. Backend sorts rows and returns summaries plus rows.

## Sorting

Rows are grouped and ordered by parsed sprint week number:

- `W22` and `W22 - CURRENT` both parse as week `22`.
- `W24`, `W24 - CURRENT`, and future labels such as `W25` or `W26` parse by the
  integer after the leading `W`.
- Lower week numbers appear first.
- Labels without a parseable week number appear after numbered sprints, sorted
  alphabetically.

Within each sprint group, rows are sorted by the numeric `Prio score` custom
field ascending. Missing `Prio score` sorts last within its sprint. Ties fall
back to ClickUp `orderindex`, then task custom ID/title for stable rendering.

## Backend Shape

Shared types will define:

- `SprintPlanningReport`
- `SprintPlanningSummary`
- `SprintPlanningRow`
- `SprintPlanningTimeMetrics`

The row model will include:

- task id and custom id
- title and URL
- task type and status
- assignee names
- sprint label
- prio score
- estimate, tracked, and remaining time metrics
- direct/rolled subtask count
- missing-estimate flag

The route will return:

```json
{
  "report": {
    "viewId": "234bx-100375",
    "dayHours": 8,
    "totals": {},
    "sprints": [],
    "rows": []
  }
}
```

## Frontend Shape

The app shell will show visible tabs for Daily and Sprint Planning. The existing
Verification route stays available but hidden from navigation.

The Sprint Planning page will use the existing resource-loader and error-state
patterns. It will show:

- a header with Refresh
- all-up totals
- per-sprint totals in ascending week order
- a dense table grouped by sprint label
- row links to ClickUp tasks
- clear visual treatment for missing estimates and negative remaining values

The page does not need editable filters in v1 because the ClickUp view already
owns membership.

## Error Handling

- `401`: show the existing Connect ClickUp action.
- `429`: show the existing rate-limit tone and retry guidance.
- Unexpected ClickUp shapes: fail the route with a backend service error rather
  than returning partial totals.
- Unknown sprint labels: include the row under an `Unassigned Sprint` or literal
  unknown label bucket, sorted after numbered sprint labels.
- Missing estimates: treat as zero for arithmetic but flag the row and summarize
  the count.
- Negative remaining time: preserve the negative value. Do not clamp it.

## Testing

Backend tests should be written first for:

- rows are selected from view tasks rather than a hard-coded sprint label
- parent plus subtask estimate/tracked rollups
- subtask rows are not double-counted as top-level rows
- sprint labels parse generically across `W22`, `W24 - CURRENT`, `W25`, `W26`
- sort order is week number, then `Prio score`
- missing estimates are counted and flagged
- the `/api/clickup/planning` route returns either `report` or a session/error
  message like the existing routes

Frontend tests should cover pure formatting/sorting helpers if they are split
out. Manual verification should run the app, open `/planning`, and compare task
membership against the ClickUp view.

## References

- ClickUp Get View: https://developer.clickup.com/reference/getview
- ClickUp Get View Tasks: https://developer.clickup.com/reference/getviewtasks
- ClickUp Filter Views: https://developer.clickup.com/docs/filter-views
- Local research: `clickup-estimation-research.md`
