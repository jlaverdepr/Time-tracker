---
name: Daily-reset todo logic
description: How daily reset is implemented and why TODAY must not be a module-level constant
---

## Daily reset rule
- Tasks in a `resetDaily=true` list are visually incomplete if `task.completedDate !== today`
- `today` must be computed at call time: `todayStr()` from `@workspace/shared` — NOT as a module-level const
- **Why:** A module-level `const TODAY = ...` is evaluated once at bundle load. If the app stays open past midnight, daily tasks never reset visually until hard reload.

## Calendar summary endpoint logic
- For **daily** lists: include all dates in range; `completedTasks = tasks where completedDate = date`
- For **non-daily** lists: only include dates where `completedTasks > 0` (skip days with no activity to avoid calendar clutter)
- **Why:** Non-daily lists don't have a meaningful "0% today" state — the task is just still pending. Showing a 0% badge every day would mislead the user into thinking the list was reviewed that day.

## resetDaily must be editable
- `TodoListUpdate` OpenAPI schema and PATCH route must accept `resetDaily` to allow changing a list from daily to persistent or vice versa.
