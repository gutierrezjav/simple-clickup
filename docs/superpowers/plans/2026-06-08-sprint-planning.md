# Sprint Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Sprint Planning tab that mirrors ClickUp view `234bx-100375` membership and calculates parent plus subtask estimate, tracked, and remaining time correctly.

**Architecture:** Extend the existing OAuth-backed ClickUp read service with view-task fetching and a planning report builder. Add shared planning report types, expose `/api/clickup/planning`, then render a dense `/planning` frontend route with sprint totals and grouped rows.

**Tech Stack:** TypeScript, Express, React, Vite, Vitest, existing ClickUp REST client.

---

## File Structure

- Modify `shared/src/types.ts`: add sprint planning report interfaces.
- Modify `backend/src/clickup/types.ts`: add ClickUp time fields, URLs, and custom-field metadata already used by planning.
- Modify `backend/src/clickup/client.ts`: add paginated `getViewTasks(viewId)` and `getTask(taskId, { subtasks })`.
- Modify `backend/src/clickup/service.ts`: add pure planning report helpers and `getSprintPlanningReport()`.
- Modify `backend/src/routes/clickup.ts`: add `/planning`.
- Modify `backend/test/clickup-service.test.ts`: add failing tests for planning rollups, generic sprint labels, sorting, and service loading.
- Modify `backend/test/app.test.ts`: add planning API route coverage.
- Modify `frontend/src/lib/clickup-api.ts`: add planning API fetch and response type.
- Create `frontend/src/lib/sprint-planning.ts`: formatting helpers for hours/days and negative values.
- Create `frontend/src/lib/sprint-planning.test.ts`: helper tests.
- Create `frontend/src/routes/planning-page.tsx`: render planning page.
- Modify `frontend/src/app.tsx`: add navigation tabs, `/planning` route, and title.
- Modify `frontend/src/styles.css`: add planning page/table styles.

## Task 1: Backend Planning Report Tests

- [ ] **Step 1: Write failing tests**

Add tests in `backend/test/clickup-service.test.ts` that import `buildSprintPlanningReport` and verify:

```ts
it("rolls parent and subtask time into sprint planning rows", () => {
  const report = buildSprintPlanningReport(
    [
      createTask({
        id: "story-w24",
        name: "Story W24",
        status: "SPRINT BACKLOG",
        customItemId: storyTaskTypeId,
        timeEstimate: 2 * hourMs,
        timeSpent: hourMs,
        sprintValue: 23,
        prioScore: 10,
        subtasks: [
          createTask({
            id: "task-child",
            name: "Child",
            status: "IN PROGRESS",
            parent: "story-w24",
            timeEstimate: 6 * hourMs,
            timeSpent: 2 * hourMs
          })
        ]
      })
    ],
    taskTypeMap,
    createPlanningMetadata()
  );

  expect(report.rows[0]).toMatchObject({
    taskId: "story-w24",
    sprintLabel: "W24 - CURRENT",
    estimateHours: 8,
    trackedHours: 3,
    remainingHours: 5,
    remainingDays: 0.625,
    rolledSubtaskCount: 1
  });
});
```

Add a second test for sorting `W22`, `W24 - CURRENT`, `W25`, and missing prio scores by week then `Prio score`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test --workspace backend -- clickup-service.test.ts`

Expected: fail because `buildSprintPlanningReport` does not exist.

## Task 2: Backend Planning Report Implementation

- [ ] **Step 1: Add shared/backend types**

Add `SprintPlanningReport`, `SprintPlanningSprintSummary`, `SprintPlanningRow`, and time metric fields to `shared/src/types.ts`. Add `time_estimate`, `time_spent`, `url`, and optional nested custom-field metadata support to `backend/src/clickup/types.ts`.

- [ ] **Step 2: Implement pure report helpers**

In `backend/src/clickup/service.ts`, implement:

- sprint label resolution from dropdown option id or orderindex
- generic `W<number>` parsing
- descendant flattening with de-dupe
- parent/subtask time rollups
- per-sprint and all-up totals
- sorting by week number, prio score, orderindex, custom id/title

- [ ] **Step 3: Run backend tests**

Run: `npm run test --workspace backend -- clickup-service.test.ts`

Expected: pass.

## Task 3: ClickUp Client View Reads

- [ ] **Step 1: Write service loading test**

In `backend/test/clickup-service.test.ts`, spy on `ClickUpClient.prototype.getViewTasks`, `getTask`, and existing metadata calls. Verify `createClickUpReadService(...).getSprintPlanningReport()` loads visible view tasks and calls full task details for parent rows.

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test --workspace backend -- clickup-service.test.ts`

Expected: fail because client/service methods do not exist.

- [ ] **Step 3: Implement client methods**

In `backend/src/clickup/client.ts`, add:

```ts
async getViewTasks(viewId: string): Promise<ClickUpTaskPayload[]>
async getTask(taskId: string, options?: { subtasks?: boolean }): Promise<ClickUpTaskPayload>
```

Use `GET /view/{view_id}/task?page=N`, stop on empty page or `last_page`, and keep the same safety limits as list tasks.

- [ ] **Step 4: Implement service method**

Add `getSprintPlanningReport()` to `ClickUpReadService`, load metadata, view tasks, and detailed parent tasks, then call `buildSprintPlanningReport`.

- [ ] **Step 5: Run backend tests**

Run: `npm run test --workspace backend -- clickup-service.test.ts`

Expected: pass.

## Task 4: Planning API Route

- [ ] **Step 1: Write failing route test**

In `backend/test/app.test.ts`, add a test for `/api/clickup/planning` mirroring the existing route assertions: response is JSON and contains either `report` or `message`.

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test --workspace backend -- app.test.ts`

Expected: fail because route is missing.

- [ ] **Step 3: Add route**

In `backend/src/routes/clickup.ts`, add:

```ts
clickupRouter.get("/planning", async (req, res) => {
  await sendReadServiceResponse(req, res, async (readService) => ({
    report: await readService.getSprintPlanningReport()
  }));
});
```

- [ ] **Step 4: Run backend tests**

Run: `npm run test --workspace backend`

Expected: pass.

## Task 5: Frontend API and Helpers

- [ ] **Step 1: Write failing helper tests**

Create `frontend/src/lib/sprint-planning.test.ts` for hour/day formatting and negative remaining class selection.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test --workspace frontend -- sprint-planning.test.ts`

Expected: fail because helper module is missing.

- [ ] **Step 3: Implement helper module and API fetch**

Create `frontend/src/lib/sprint-planning.ts`; modify `frontend/src/lib/clickup-api.ts` to add `PlanningPageData` and `fetchPlanningPageData()`.

- [ ] **Step 4: Run frontend tests**

Run: `npm run test --workspace frontend -- sprint-planning.test.ts`

Expected: pass.

## Task 6: Frontend Planning Page

- [ ] **Step 1: Implement route and navigation**

Create `frontend/src/routes/planning-page.tsx` using existing resource state patterns. Modify `frontend/src/app.tsx` to add visible Daily and Sprint Planning tabs, route `/planning`, and document title.

- [ ] **Step 2: Add styles**

Modify `frontend/src/styles.css` for planning summary cards, grouped sprint sections, and dense responsive table.

- [ ] **Step 3: Run frontend verification**

Run: `npm run test --workspace frontend`

Expected: pass.

Run: `npm run typecheck --workspace frontend`

Expected: pass.

## Task 7: Full Verification

- [ ] **Step 1: Run full test suite**

Run: `npm run test`

Expected: pass.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: pass.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: pass.

- [ ] **Step 4: Start dev server**

Run: `npm run dev`

Expected: frontend available at `http://localhost:3000` and backend at `http://localhost:4000`.

- [ ] **Step 5: Smoke test**

Open `/planning`, verify the page loads, the Connect ClickUp action appears when unauthenticated, or live sprint data appears when authenticated.
