---
name: Codegen workflow
description: Exact steps to follow after editing openapi.yaml or lib schema files
---

## After editing `lib/api-spec/openapi.yaml`
1. `cd lib/api-spec && npx orval --config ./orval.config.ts`
2. `pnpm run typecheck:libs` — rebuilds .d.ts files in lib/api-client-react and lib/api-zod
3. Then run package typechecks: `pnpm --filter @workspace/api-server run typecheck && pnpm --filter @workspace/time-tracker run typecheck`

**Why:** orval writes to `src/generated/` but TypeScript references the compiled `dist/` via package exports. Without step 2 the .d.ts files are stale and the api-server typecheck fails with "has no exported member" errors even though the source is correct.

## After editing `lib/db/src/schema/`
1. Export new tables from `lib/db/src/schema/index.ts`
2. `pnpm run typecheck:libs`
3. `pnpm --filter @workspace/db run push`

## Zod schema naming convention (orval output)
Pattern: `{OperationId}{Segment}` where Segment is Body/Params/QueryParams/Response/ResponseItem
Examples: `CreateTodoListBody`, `UpdateTodoListParams`, `GetTodoCalendarSummaryQueryParams`, `ListTodoListsResponse`
