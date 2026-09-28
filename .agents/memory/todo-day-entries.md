---
name: To-do day entries
description: How to-dos are stored per calendar day, the rollover/carry rules, and where the logic lives
---

## Model
- `todo_tasks` = what a task is (text, project, reminder, sortOrder). `todo_entries` = one row per task per day (`date`, `listId`, `status` pending|done, `copiedFromDate`, `copiedFromEntryId`).
- A day's state is exactly its entries. Percentages (`GET /todo-entries/summary`) and calendar badges come straight from them; a list badge shows on a day iff it has ≥1 entry there (incl. tasks added ahead).
- All rules live in `artifacts/api-server/src/lib/todo-days.ts`, covered by `todo-days.test.ts` (`pnpm --filter @workspace/api-server test`, fake clock).

## Rules
- List `carryMode`: `carry` copies pending entries to the next day, linked via `copiedFromEntryId`; `repeat` copies every entry as an independent pending entry (no link); `none` copies nothing. Done entries are never carried.
- Rollover is lazy (server may sleep): middleware calls `ensureRolledOver()` on every to-do request, catching up from `lastRolledDate`. "Today" is server-local — `TZ` is set in fly.toml.
- Marking an entry done deletes the copies made from it (FK `ON DELETE CASCADE` on `copied_from_entry_id` removes the whole chain). Un-completing a past carry entry re-copies it forward to today. Deleting an entry deletes its copies; a task with no entries left is deleted.
- `autoClearCompleted` only affects the To-Do view (`includeEarlierDone`): whether earlier days' done entries keep showing until cleared. Clearing hides; it never changes history.

**Why:** the previous model rebuilt per-day history from a single task row on every request, so edits rewrote past days and percentages drifted.
