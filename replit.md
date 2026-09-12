# CorridorIQ — Smart Location Intelligence

An interactive Dallas–Fort Worth corridor intelligence dashboard that helps operators compare locations and choose concept opportunities from supplied behavioral and whitespace data.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/corridor-iq/` — the deployable React/Vite dashboard.
- `artifacts/api-server/data/corridors.csv` — the supplied 72-corridor dataset.
- `artifacts/api-server/src/routes/corridors.ts` — CSV parsing, score calculations, and dashboard endpoints.
- `lib/api-spec/openapi.yaml` — source of truth for the typed corridor API contract.
- `artifacts/corridor-iq/src/index.css` — app theme, chart styling, dark mode, and print overrides.

## Architecture decisions

- Corridor data is read from the supplied CSV through the shared API server, then cached in memory for the process lifetime.
- Location Opportunity Score is transparent and data-derived: whitespace, neighborhood momentum, safety, audience fit, daypart demand, resilience, and accessibility are weighted from 0–100 inputs.
- Category scores use the matching whitespace field plus category-relevant audience signals; they are recommendations, not revenue or demand forecasts.
- The map is intentionally district-level because the prototype CSV has no latitude/longitude coordinates.

## Product

CorridorIQ provides an executive market snapshot, ranked opportunity corridors, category whitespace heatmaps, concept recommendations, search/filter/sort exploration, corridor comparison, detailed profiles, audience and daypart analysis, and risk/resilience signals. The UI labels its main metric as a Data-Derived Opportunity Score and avoids unsupported claims about revenue, population, rent, sales, or foot traffic.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The API workflow runs from `artifacts/api-server`, so the runtime CSV path is `data/corridors.csv`.
- Re-run `pnpm --filter @workspace/api-spec run codegen` whenever `lib/api-spec/openapi.yaml` changes.
- Use the shared proxy path `/api` for corridor data; do not call the API service port directly from browser code.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
