# Bigcapital Monorepo — Architectural Code Review

> **Reviewer:** Antigravity AI (Senior Architect Mode)
> **Date:** 2026-07-31
> **Scope:** Full codebase — packages/server, packages/webapp, shared/*, infrastructure

---

## 1. Project Understanding

### What This Application Does

Bigcapital is a **multi-tenant, open-source financial accounting SaaS platform** targeting small and medium-sized businesses. It provides:

- **Double-entry bookkeeping** — accounts, ledger, journal entries, manual journals
- **Full AP/AR cycle** — sale invoices, estimates, receipts, credit notes, bill payments, vendor credits
- **Purchasing** — purchase invoices (bills), bill payments, landed costs
- **Banking** — bank account sync (Plaid), transaction categorization, matching, and rules
- **Inventory** — items, item categories, inventory adjustments, COGS tracking
- **Financial reports** — Balance Sheet, P&L, General Ledger, Trial Balance, Cash Flow, Aging Summaries, Inventory Valuation, Tax Liability, and more (21 reports total)
- **Multi-currency** — exchange rates, foreign balance computation
- **PDF export** — via Gotenberg service; branded PDF templates
- **Payments** — Stripe Connect and LemonSqueezy subscription billing
- **Warehouses & Branches** — multi-location inventory and cost tracking
- **RBAC** — role-based access control via CASL
- **Tenant isolation** — each organization gets its own MariaDB database

### Tech Stack

| Layer | Technology |
|---|---|
| **Monorepo** | pnpm workspaces + Lerna |
| **Server** | NestJS 10 (Node 18), TypeScript 5 |
| **ORM** | Objection.js (on top of Knex) |
| **Database** | MariaDB 10.2 (system DB + per-tenant DBs) |
| **Auth** | Passport (JWT HS384 + Local + API Key), CASL abilities |
| **Queue** | BullMQ + Redis |
| **Cache** | Redis + LRU in-process cache |
| **PDF** | Gotenberg (Chrome headless via HTTP) |
| **Storage** | AWS S3 / MinIO (attachments, logos, documents) |
| **Email** | Nodemailer + BullMQ queue |
| **Real-time** | Socket.IO |
| **Frontend** | React 18 + Vite 5 |
| **State** | Redux (legacy) + Redux Persist + React Query v3 |
| **UI Library** | BlueprintJS 4 |
| **API Layer** | Generated TypeScript SDK (`sdk-ts`) from OpenAPI spec |
| **i18n** | nestjs-i18n (server) + react-intl-universal (client) |
| **Observability** | PostHog (analytics), New Relic (optional APM) |
| **CI/CD** | GitHub Actions (build, deploy, E2E, typecheck) |
| **Infra** | Docker Compose (Envoy proxy, MariaDB, Redis, Gotenberg, MinIO) |

### Overall Architecture

```
Browser (React SPA)
    |  HTTP(S) via Envoy reverse proxy
    v
+-------------------------------------------------------------+
| NestJS Server  (/api prefix)                                |
|                                                             |
|  Controllers -> Application Services -> Domain Services     |
|                    |                                        |
|            Objection / Knex ORM                             |
|                    |                                        |
|       +------------+------------+                           |
|  System DB (bigcapital_system)  Per-Tenant DBs              |
|  Users, Tenants, API Keys       All accounting data         |
+-------------------------------------------------------------+
         |                |             |
       Redis           BullMQ         MinIO/S3
    (cache/sessions)  (job queues)  (attachments)
```

The backend follows a **modular NestJS** architecture — 80 feature modules all wired into one `AppModule`. Tenancy is achieved through:

1. **CLS (Continuation Local Storage)** — `organization-id` HTTP header is extracted per-request and stored in `ClsService`
2. **LRU-cached Knex connections** — `TenancyDatabaseProxyProvider` creates/returns a cached `KnexInstance` per tenant database name
3. **Guard chain** — `MixedAuthGuard` -> `TenancyGlobalGuard` -> `EnsureTenantIsInitialized` -> `PermissionGuard`

The frontend is a **traditional Redux SPA** using React Router v5, Formik forms, and BlueprintJS. Server data fetching uses `react-query` v3 but the majority of async state still lives in Redux. The SDK layer (`sdk-ts`) wraps an auto-generated OpenAPI client.

### Purpose of Major Folders

| Path | Purpose |
|---|---|
| `packages/server/src/modules/` | 80 NestJS feature modules (one per business domain) |
| `packages/server/src/modules/App/App.module.ts` | Root module; wires all 80 modules together |
| `packages/server/src/modules/Ledger/` | Core double-entry ledger (immutable entry journal, storage, revert) |
| `packages/server/src/modules/Tenancy/` | Per-request DB isolation, model binding, guards |
| `packages/server/src/modules/Auth/` | JWT/Local/API-key auth, signup/login/reset, RBAC |
| `packages/server/src/modules/FinancialStatements/` | 21 financial reports each with injectable, repository, table formatter, and PDF exporter |
| `packages/server/src/common/` | Cross-cutting: config, decorators, DTOs, exceptions, filters, interceptors, pipes |
| `packages/server/src/database/system/` | Knex migrations and seeds for the system database |
| `packages/server/src/database/tenant/` | Knex migrations and seeds for tenant databases |
| `packages/webapp/src/containers/` | Page-level React feature containers (55 features) |
| `packages/webapp/src/store/` | Redux store, reducers, middleware (40+ reducers) |
| `packages/webapp/src/services/` | API service wrappers using react-query hooks |
| `shared/sdk-ts/` | Auto-generated OpenAPI TypeScript client + custom fetch utilities |
| `shared/email-components/` | React-based email templates (rendered server-side) |
| `shared/pdf-templates/` | React/HTML PDF templates rendered via Gotenberg |
| `shared/bigcapital-utils/` | Shared utility functions used by server and webapp |
| `docker/` | Service-specific Dockerfiles (MariaDB, Redis, Envoy) |

---

## 2. Code Quality Review

### Good Practices Already in Use

1. **Strong modular decomposition** — Each business domain has its own NestJS module with clearly separated controllers, application services, commands, queries, subscribers, and DTOs.
2. **CQRS-inspired naming** — Services are named `CreateSaleInvoice.service`, `GetSaleInvoices.service`, etc., reflecting command/query separation even without a full CQRS bus.
3. **Event-driven choreography** — `EventEmitter2` is used to decouple side-effects (ledger writes, inventory updates, email) from domain operations via domain events.
4. **Unit of Work pattern** — `UnitOfWork.service.ts` wraps Knex transactions correctly rolling back on failure and allows callers to pass an existing transaction.
5. **Domain-specific Ledger class** — `Ledger.ts` is a well-designed value object with fluent filtering, balance computation, and factory methods. It cleanly separates accounting domain logic from persistence.
6. **CASL-based RBAC** — The `AbilitySchema` with CRUD + extra permissions per subject is a mature authorization model.
7. **Config module pattern** — Each concern has its own `registerAs` config file; no raw `process.env` calls scattered through services.
8. **BullMQ for email/async tasks** — Queuing email delivery avoids blocking the request cycle.
9. **Swagger decorators** — Controllers include `@ApiTags`, `@ApiOperation`, `@ApiBody`, `@ApiResponse` decorators, enabling automatic API documentation.
10. **LRU connection cache for tenants** — Avoids creating a new Knex pool per request.
11. **Healthcheck-based `depends_on`** in Docker Compose — Correct use of `service_healthy` conditions prevents race conditions at startup.

### Code Smells & Technical Debt

1. **Widespread `@ts-nocheck`** — `packages/webapp/src/index.tsx`, `store/createStore.tsx`, and `store/reducers.tsx` all begin with `// @ts-nocheck`. This silences the type checker for critical bootstrap files and indicates accumulated type debt.

2. **Hardcoded JWT secret fallback** — `jwt.ts` falls back to `'123123'` if `APP_JWT_SECRET` is unset. A missing env var should throw at startup, not silently use a known insecure value.

3. **`isEmpty` import confusion** — `AuthSignup.service.ts` imports `isEmpty` from `class-validator` rather than `lodash`. The two have different semantics (`class-validator`'s `isEmpty` treats the string `'0'` as empty), which can introduce subtle signup-restriction bugs.

4. **Typos in file and folder names** — Multiple confirmed typos exist:
   - `BankingTranasctionsRegonize/` (double typo)
   - `AuthMailMessages.esrvice.ts` (`.esrvice` instead of `.service`)
   - `AuthApplication.sevice.ts` (`.sevice`)
   - `InventoryAdjutments/` (missing `s`)

5. **`LRUCache` initialized without options** — `TenancyDB.module.ts` calls `new LRUCache()` with no `max` or `ttl` option. lru-cache v6 requires a `max` option; without it the cache grows unbounded — a memory leak as tenants accumulate.

6. **`UnitOfWork` uses `READ_UNCOMMITTED` isolation by default** — This is the least safe isolation level and can lead to dirty reads. In a financial application the default should be `READ_COMMITTED` or `REPEATABLE_READ`.

7. **`verifyPayload` returns the raw JWT payload** — `AuthSignin.service.ts`'s `verifyPayload` loads the user from the database but returns the raw `payload` object. The DB user is loaded on every authenticated request and then discarded.

8. **`ApplicationState` interface is empty** — `store/reducers.tsx` declares `interface ApplicationState {}` but never populates it. The Redux state is effectively untyped throughout the frontend.

9. **Mixed styling systems** — The webapp uses Sass, BlueprintJS, styled-components, Emotion, `@xstyled/emotion`, ThemeUI, and basscss simultaneously, creating CSS runtime overhead and inconsistent theming.

10. **Dual bcrypt libraries** — Both `bcrypt` and `bcryptjs` appear in `server/package.json`. `Auth.utils.ts` uses `bcrypt` (native). `bcryptjs` is redundant dead weight.

11. **Two queue libraries** — Both `bull` (legacy) and `bullmq` (current) are present. They use incompatible Redis data structures, suggesting an incomplete migration.

12. **Two validation libraries** — Both `express-validator` and `class-validator` are dependencies. The codebase uses `class-validator` via NestJS pipes; `express-validator` appears unused.

13. **`moment.js` still in use** — `moment`, `moment-range`, and `moment-timezone` are massive legacy libraries used on both server and client. `date-fns` or `dayjs` would be far lighter.

14. **Legacy Redux bootstrap** — `createStore.tsx` uses the deprecated `createStore` from Redux (v4), bypasses TypeScript with `@ts-nocheck`, and manually composes enhancers. Redux Toolkit would eliminate most of this boilerplate.

15. **Deprecated React APIs** — The webapp uses `ReactDOM.render` (deprecated as of React 18) instead of `createRoot`. `react-query` v3 is also EOL; v5 is current.

---

## 3. Architecture Review

### Scalability

**Strengths:**
- BullMQ + Redis provides a durable job queue for email, PDF generation, org initialization, and bank sync — workloads that should not run in the HTTP request cycle.
- Per-tenant database isolation means tenant data never mingles, and a large tenant's queries cannot lock another tenant's data.
- MinIO provides horizontally scalable object storage.

**Weaknesses:**
- **Single NestJS process** — All 80 modules run in one monolithic process. There is no way to independently scale financial reporting (CPU-heavy) separately from the CRUD API.
- **LRU connection cache has no eviction policy** — With no `max` configured, the LRU pool can accumulate hundreds of open Knex connection pools, exhausting the MariaDB `max_connections` limit under multi-tenant load.
- **Financial statement computations are in-memory** — Reports like Balance Sheet fetch all account transactions into memory via `Ledger.fromTransactions()` and filter/aggregate in JavaScript. No pagination or streaming is implemented for the data layer.
- **MariaDB 10.2 is EOL** — Reached end-of-life in May 2022. No security patches are available.

### Maintainability

**Strengths:**
- Very consistent module structure (controller / application / commands / queries / subscribers / dtos / models).
- Config files are well-separated; no magic env reads inside services.
- The Ledger abstraction is clean and centralized.

**Weaknesses:**
- **`App.module.ts` is a 300-line god import list** — 80 module imports make it hard to understand the application's dependency graph.
- **No shared domain model** — Server and webapp duplicate entity types. The SDK exposes only OpenAPI-derived types.
- **BalanceSheet module is 38 files** — A single financial report spans 38 files with very thin classes (e.g. `BalanceSheetTotal.ts` is 100 bytes). The mixin/inheritance chain for comparison periods, percentages, date periods, and net income creates a deep hierarchy that is hard to trace.

### Separation of Concerns

**Strengths:**
- The controller -> application service -> command/query service layering is well maintained.
- Guards are correctly applied at the module/route level rather than embedded in services.
- The `Ledger` class is purely a domain object — it has no I/O.

**Weaknesses:**
- **Auth controller fetches a tenant from a model injected directly** — `Auth.controller.ts` injects `TenantModel` and queries it inline (line 63). This bypasses the application service layer.
- **`TenancyContext.service.ts` blends context and identity** — `getTenant()`, `getSystemUser()`, and `getTenantJobPayload()` live in one service. Context retrieval (from CLS) and identity resolution (DB queries) should be separated.

### Dependency Management

- **Duplicated libraries**: `bcrypt`+`bcryptjs`, `bull`+`bullmq`, `express-validator`+`class-validator`
- **Pinned versions without comments** — Pins like `bcrypt: 5.1.1`, `sanitize-html: 2.17.5` lack inline comments explaining why. Future developers will remove pins not knowing the reason.
- **`@tiptap/extension-color: "latest"`** — Using `latest` in a production dependency is a CI reliability risk.
- **Node engine range too wide** — `"node": "16.x || 17.x || 18.x"` — Node 16 and 17 are both EOL.

### Data Flow

1. **Request path:** Browser -> Envoy -> NestJS -> Guards (auth, tenant, permission) -> Controller -> Application Service -> Command/Query -> Knex/Objection -> MariaDB
2. **Side-effects path:** Command Service -> `EventEmitter2.emitAsync()` -> Subscriber (GL write, inventory update, mail queue)
3. **Background path:** Mail/Org-build jobs -> BullMQ -> Redis -> Processor -> Service
4. **Frontend:** SDK fetch -> `react-query` hook -> Redux action (for some) -> Component

The dual use of `react-query` **and** Redux for server state creates two sources of truth for the same data. React Query should own all server state; Redux should be limited to UI/client-only state.

### API Design

- **Global `/api` prefix** on all routes — correct.
- **JWT HS384** — a good choice (stronger than HS256).
- **Organization identity via header** (`organization-id`) — works but is unconventional. Most multi-tenant APIs embed the tenant in the JWT payload or use subdomain routing.
- **OpenAPI spec** is generated and used to produce the `sdk-ts` client — excellent; it keeps client/server in sync.
- **No API versioning** — No `/api/v1/` prefix. Adding one later would be a breaking change for all clients.
- **Throttling** is implemented via `@nestjs/throttler` with separate `auth` and global rate limit namespaces — good.
- **Swagger UI** is exposed at `/swagger` with no authentication — should be disabled or protected in production.

---

## 4. Security Review

### 4.1 Hardcoded JWT Secret Fallback — CRITICAL

```typescript
// packages/server/src/common/config/jwt.ts
secret: process.env.APP_JWT_SECRET || '123123',
```

If `APP_JWT_SECRET` is not set, the server silently uses `"123123"`. Any attacker knowing this value can forge valid JWTs for **any user on any tenant**. The server should throw a startup error if the secret is absent or too short.

### 4.2 Organization ID Not Validated Against JWT — HIGH

The `organization-id` header is used to select the tenant database, but it is **not validated against the authenticated JWT user's tenant**. A logged-in user of org A can send `organization-id: orgB` in their request headers and potentially gain access to org B's data. `TenancyGlobalGuard` only checks that the header is present, not that it matches the authenticated user's organization.

### 4.3 Swagger UI Exposed Without Auth — HIGH

`SwaggerModule.setup('swagger', app, documentFactory)` is registered with no guard or middleware. The Swagger UI documents every endpoint with request/response shapes. In production this gives attackers a complete attack surface map. It should be disabled in production or password-protected.

### 4.4 Hardcoded Test Credentials in Public E2E Workflow — HIGH

```yaml
# .github/workflows/e2e.yml
JWT_SECRET=test-jwt-secret-for-e2e-testing
APP_JWT_SECRET=test-app-jwt-secret
```

These are committed to the public repository. They demonstrate the pattern of hardcoded secrets and could be confused with production values.

### 4.5 Bull Board Exposed With Risky Defaults — MEDIUM

`/queues` is the BullBoard route. Authentication is configurable but if `BULL_BOARD_ENABLED` is not explicitly set, the default state is unclear. The `createBullBoardAuthMiddleware` should be audited to ensure an unconfigured state disables the route entirely.

### 4.6 `READ_UNCOMMITTED` Isolation Default — MEDIUM

```typescript
isolationLevel: IsolationLevel = IsolationLevel.READ_UNCOMMITTED
```

Dirty reads as the default isolation level can produce inconsistent ledger balances when read during a concurrent write. This is dangerous in a financial application.

### Authorization

- CASL is used correctly — abilities are built per user/role and checked via `PermissionGuard`.
- `@PublicRoute()` correctly bypasses JWT guard — verified in `JwtAuthGuard`.
- `@TenantAgnosticRoute()` correctly bypasses the tenant guard — correct for auth endpoints.
- API key authentication is a separate strategy (`passport-headerapikey`) — this is fine.

### Data Validation

- NestJS `ValidationPipe` (`class-validator`) is applied globally — input DTOs are validated.
- `sanitize-html` is pinned to `2.17.5` to avoid ESM breakage — however, the sanitization schema should be reviewed for completeness.
- File upload validation uses `file-type` and `mime-types` — correct pattern.

### Secret/Configuration Handling

- Secrets are in `.env` (gitignored) and `.env.alwathba` (gitignored) — correct.
- `.env.alwathba.example` shows MinIO root user/password as `minioadmin/minioadmin` — the template does not enforce changing these.
- No secrets detection in CI (e.g., `gitleaks`, `truffleHog`, or GitHub secret scanning) is configured.

---

## 5. Performance Review

### Database

1. **No connection pool size tuning** — Knex pool is `{ min: 0, max: 7 }` per tenant connection. With many simultaneous tenants, total DB connections could exceed MariaDB limits. `max` should be environment-configurable.

2. **Financial reports load all transactions into memory** — `Ledger.fromTransactions()` hydrates all matching account transactions into a JavaScript array, then filters/aggregates in memory. This is an O(n) memory scan on every report request with no streaming, cursor-based pagination, or database-side aggregation.

3. **N+1 query risk** — Objection.js `withGraphFetched()` is used in some places but N+1 queries are highly likely in list endpoints that lack explicit graph fetching.

4. **LRU cache without eviction** — The tenant Knex connection cache has no `max` limit. Memory grows unbounded with many tenants.

### API & Queue

5. **`EventEmitter2.emitAsync()` blocks the request** — All event subscribers are awaited sequentially. Events that do not require synchronous confirmation (email, analytics) should be fire-and-forget.

6. **PDF generation via Gotenberg is synchronous** — PDF rendering calls a remote HTTP service inside the request. This should be moved to a BullMQ job with the PDF stored in S3 and a presigned URL returned.

### Frontend

7. **Dual state management (Redux + React Query)** — The same server data can be cached in two places, leading to stale data, double fetches, and increased memory usage.

8. **`redux-persist` on the full store** — Persisting the entire Redux store (40+ reducers) to `localStorage` on every action is expensive and can serialize sensitive data (tokens, user info) in browser storage.

9. **`wdyr.ts` in production** — "Why Did You Render" debug tool is imported unconditionally and has a performance cost. It should be excluded from production builds.

10. **Three table/virtualization libraries** — `@blueprintjs/table` + `react-virtualized` + `react-table` are loaded simultaneously, tripling table-related bundle size.

11. **Five styling runtimes** — Sass, styled-components v5, Emotion, xstyled, ThemeUI — all run simultaneously, adding significant runtime CSS-in-JS overhead.

12. **`react-loadable`** — An unmaintained code-splitting library. React 18 ships `React.lazy` + `Suspense`.

---

## 6. Developer Experience Review

### Project Structure

- **Good:** One command per concern (`dev:server`, `dev:webapp`, `build:shared`) is clear.
- **Issue:** The `docs/` folder has minimal content. No ADRs, no data model documentation, no sequence diagrams for complex flows (tenant initialization, ledger write flow).
- **Issue:** 80 modules in a flat list under `src/modules/` is hard to browse. Grouping into subdirectories (`modules/finance/`, `modules/banking/`, `modules/people/`) would improve discoverability.

### Documentation

- `AGENTS.md` — Excellent. It captures key gotchas (JWT variable name, migration order, SDK workarounds).
- `README.md` — Exists but does not document the two-tier database architecture or tenant initialization flow.
- No inline `@throws` JSDoc on service methods that throw `ServiceError` — callers must read the source to know what exceptions to handle.
- `CONTRIBUTING.md` does not cover the SDK generation workflow, the two-database migration pattern, or Alwathba-specific concerns.

### Testing

- **E2E tests are severely limited** — `testRegex` is hardcoded to `auth.e2e-spec.ts$`. Only authentication is tested E2E. No coverage for invoices, ledger writes, financial reports, or billing.
- **No unit test coverage metric enforced** — `collectCoverageFrom` is configured but no `coverageThreshold` is set.
- **`init-app-test.ts` requires a pre-seeded user** — Tests are not self-contained; they assume `bigcapital@bigcapital.com / 123123123` exists.
- **No frontend tests** — The webapp has `@testing-library/react` as a dependency but no visible `.test.tsx` files.
- **No snapshot tests for PDF templates** — PDF rendering regressions would only be caught by human review.

### CI/CD

- **No lint workflow** — ESLint and Prettier are configured but no CI job enforces them on PRs.
- **No unit test workflow** — Unit tests (`*.spec.ts`) are not run in CI.
- **`sleep 10` in E2E** — Fragile; should use `wait-on` or polling.
- **`matrix.platform` is referenced but `matrix` is never defined** — Both build workflows reference `${{ matrix.platform }}` without a `strategy.matrix` definition. Dead code that silently produces an empty value.

### Local Development Workflow

- **Good:** `.env.alwathba.example` is a complete template with security notes.
- **Issue:** No `docker-compose.dev.yml` for local development with hot-reload.
- **Issue:** `generate:sdk-types` requires the server to be running — a chicken-and-egg problem when bootstrapping a fresh environment.

---

## 7. Priority Recommendations

### CRITICAL

---

#### C-1: Remove the JWT Secret Fallback

**Problem:** `jwt.ts` defaults to `'123123'` if `APP_JWT_SECRET` is unset.

**Why it matters:** An attacker knowing this string can forge any JWT, impersonating any user on any tenant. This is a complete authentication bypass.

**Suggested solution:**
```typescript
// packages/server/src/common/config/jwt.ts
export default registerAs('jwt', () => {
  const secret = process.env.APP_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'APP_JWT_SECRET must be set and at least 32 characters long. ' +
      'Generate one with: openssl rand -hex 48'
    );
  }
  return { secret };
});
```

**Files involved:** `packages/server/src/common/config/jwt.ts`

**Expected impact:** Eliminates a critical authentication bypass. Deployments with missing secrets fail fast at startup.

---

#### C-2: Validate `organization-id` Header Against the JWT User's Tenant

**Problem:** A logged-in user can pass any `organization-id` header and potentially access another tenant's data.

**Why it matters:** Tenant isolation failure — the primary security guarantee of a multi-tenant SaaS.

**Suggested solution:** In `TenancyGlobalGuard`, after validating the JWT, extract `tenantId` from the JWT payload and verify the tenant's `organizationId` matches the `organization-id` header value.

**Files involved:**
- `packages/server/src/modules/Tenancy/TenancyGlobalGuard.ts`
- `packages/server/src/modules/Auth/strategies/Jwt.strategy.ts`
- `packages/server/src/modules/Auth/commands/AuthSignin.service.ts`

**Expected impact:** Prevents cross-tenant data access.

---

### HIGH

---

#### H-1: Fix LRU Cache Missing `max` Option (Memory Leak)

**Problem:** `new LRUCache()` in `TenancyDB.module.ts` has no `max` or `ttl`.

**Why it matters:** Every unique `organizationId` creates a new Knex pool that is never evicted, exhausting server memory and MariaDB connections over time.

**Suggested solution:**
```typescript
const lruCache = new LRUCache({ max: 200 });
// Also add a dispose callback to close Knex pools on eviction.
```

**Files involved:** `packages/server/src/modules/Tenancy/TenancyDB/TenancyDB.module.ts`

**Expected impact:** Prevents a production memory/connection leak at scale.

---

#### H-2: Protect Swagger UI in Production

**Problem:** `SwaggerModule.setup('swagger', ...)` is registered unconditionally.

**Suggested solution:**
```typescript
// packages/server/src/main.ts
if (process.env.NODE_ENV !== 'production') {
  const config = new DocumentBuilder().setTitle('Bigcapital').build();
  SwaggerModule.setup('swagger', app, () => SwaggerModule.createDocument(app, config));
}
```

**Files involved:** `packages/server/src/main.ts`

**Expected impact:** Removes a public attack-surface blueprint from production deployments.

---

#### H-3: Change Default `UnitOfWork` Isolation to `READ_COMMITTED`

**Problem:** Financial transactions default to `READ_UNCOMMITTED`.

**Why it matters:** Dirty reads in a double-entry ledger can produce incorrect balances during concurrent writes.

**Suggested solution:** Change the default from `IsolationLevel.READ_UNCOMMITTED` to `IsolationLevel.READ_COMMITTED`.

**Files involved:** `packages/server/src/modules/Tenancy/TenancyDB/UnitOfWork.service.ts`

**Expected impact:** Prevents inconsistent financial reads under concurrent load.

---

#### H-4: Complete `bull` to `bullmq` Migration

**Problem:** Both `bull` (legacy) and `bullmq` (current) are present as dependencies.

**Why it matters:** `bull` and `bullmq` use incompatible Redis data structures. Running both simultaneously can corrupt queue state. `bull` is no longer maintained.

**Suggested solution:** Audit all queue registrations. Remove all `bull` references and replace with `bullmq`. Remove `@nestjs/bull` and keep only `@nestjs/bullmq`.

**Files involved:** `packages/server/package.json`, any `@nestjs/bull` imports across modules.

**Expected impact:** Eliminates a dependency conflict and a potential data corruption risk.

---

#### H-5: Add `organization-id` to JWT Payload

**Problem:** The JWT payload only contains `{ sub: email }`. Tenant identity is not embedded in the token.

**Suggested solution:** Include `tenantId` and `organizationId` in the JWT payload at sign time. Validate these in `JwtStrategy.validate()`.

**Files involved:**
- `packages/server/src/modules/Auth/commands/AuthSignin.service.ts` (`signToken`)
- `packages/server/src/modules/Auth/strategies/Jwt.strategy.ts`

**Expected impact:** Closes the tenant-isolation gap structurally. Enables stateless tenant resolution without a DB query per request.

---

### MEDIUM

---

#### M-1: Enforce Test Coverage in CI

Add a GitHub Actions workflow that runs `pnpm run test:cov` and fails below a threshold. Add `coverageThreshold` to `jest` config in `server/package.json`.

**Files involved:** `.github/workflows/` (new file), `packages/server/package.json`

---

#### M-2: Extend E2E Test Coverage Beyond Auth

The `testRegex` in `jest-e2e.json` is pinned to `auth.e2e-spec.ts$`. Add E2E specs for invoice creation/deletion, balance sheet report, tenant initialization, and user RBAC.

**Files involved:** `packages/server/test/jest-e2e.json`, `packages/server/test/`

---

#### M-3: Migrate Redux to Redux Toolkit

Replace legacy `createStore`, `@ts-nocheck`, and manual enhancer composition with Redux Toolkit's `configureStore` + `createSlice`. Populate `ApplicationState` interface.

**Files involved:** `packages/webapp/src/store/createStore.tsx`, all `*.reducer.tsx` files.

---

#### M-4: Replace `ReactDOM.render` with `createRoot`

Update `index.tsx` to use `ReactDOM.createRoot(document.getElementById('root')!).render(...)`.

**Files involved:** `packages/webapp/src/index.tsx`

---

#### M-5: Remove `wdyr` from Production

Guard "Why Did You Render" initialization with `if (process.env.NODE_ENV === 'development')`.

**Files involved:** `packages/webapp/src/index.tsx`, `packages/webapp/src/wdyr.ts`

---

#### M-6: Upgrade MariaDB from 10.2 (EOL)

Test against MariaDB 10.6 LTS or 10.11 LTS. The main risk is Knex/Objection query compatibility.

**Files involved:** `docker/mariadb/`, `docker-compose.alwathba.yml`, `docker-compose.prod.yml`

---

#### M-7: Rename Typo-Afflicted Files and Folders

Rename `BankingTranasctionsRegonize/`, `AuthMailMessages.esrvice.ts`, `AuthApplication.sevice.ts`, `InventoryAdjutments/` using `git mv` to preserve history. Add a pre-commit hook to enforce naming conventions.

**Files involved:** Various across `packages/server/src/modules/`

---

#### M-8: Add a Lint CI Workflow

Add a GitHub Actions workflow that runs `pnpm lint` and `pnpm format:check` on every PR.

**Files involved:** `.github/workflows/` (new file)

---

### LOW

---

#### L-1: Consolidate CSS-in-JS Solutions

Five styling systems run in parallel (Sass, styled-components, Emotion, xstyled, ThemeUI). Align on one system and migrate gradually.

---

#### L-2: Replace `moment` with `date-fns` or `dayjs`

`moment` + `moment-range` + `moment-timezone` add significant bundle weight. Migrate date logic to `date-fns` (server) and `dayjs` (client). The Ledger date filtering is the primary migration target.

---

#### L-3: Move Financial Report Aggregation to SQL

Implement `SUM`, `GROUP BY`, and date-range filters in the repository layer. Reserve the in-memory `Ledger` class for lightweight post-processing only.

---

#### L-4: Pin `@tiptap/extension-color` to a Specific Version

Replace `"latest"` with the specific version currently resolved in `pnpm-lock.yaml`.

---

#### L-5: Add API Versioning

Add a `/api/v1/` prefix. New incompatible endpoints go to `/api/v2/`.

---

#### L-6: Fix Dead Code in Build Workflows (`matrix.platform`)

Both Docker build workflows reference `${{ matrix.platform }}` without a `strategy.matrix` definition. Remove the "Prepare" step or define the correct matrix strategy.

---

#### L-7: Persist Only Necessary Redux Slices

Use `persistReducer` with an `allowlist` that only includes user preferences and UI settings. Remove sensitive auth data from `localStorage`.

---

## 8. AI Coding Agent Guidance

The following instructions are for any AI coding agent (OpenCode, Cursor, Aider, or Antigravity) working on this codebase.

---

### Before You Start

1. **Read `AGENTS.md` in the repo root first.** It contains critical gotchas: the `APP_JWT_SECRET` variable name, migration order, the SDK `__fetcherConfig` workaround, and Alwathba self-hosted stack details.
2. **Never use `JWT_SECRET`** — the server reads `APP_JWT_SECRET`. Using the wrong variable name causes silent fallback to the hardcoded `'123123'` secret.
3. **Build order matters**: `shared/*` must be built before `server` or `webapp`. Always run `pnpm run build:shared` first in a fresh environment.
4. **Two database tiers**: system DB (`bigcapital_system`) holds users, tenants, API keys, and password resets. Per-tenant DBs (`bigcapital_tenant_<orgId>`) hold all accounting data. Migrations must run on both: system first, then tenants.

### Architecture Rules

5. **Follow the existing module structure.** Every new business feature must be a NestJS module with: `*.module.ts`, `*.controller.ts`, optional `*.application.ts`, `commands/`, `queries/`, `subscribers/`, `dtos/`, `models/`.
6. **Do not bypass the application service layer in controllers.** Controllers should call application services, not inject ORM models directly. The `Auth.controller.ts` line 63 direct `this.tenantModel.query()` call is a known violation — do not replicate it.
7. **All DB writes must go through `UnitOfWork.withTransaction()`.** Never call `.insert()`, `.update()`, or `.patch()` outside a transaction if the operation touches multiple records.
8. **All financial side-effects must emit events.** Subscribers handle ledger writes, inventory updates, and notifications. Do not call ledger or inventory services directly from the domain service.
9. **Never hardcode tenant database names.** Always read `organizationId` from CLS (`this.cls.get('organizationId')`) or `ConfigService`. The prefix is `bigcapital_tenant_`.
10. **Never add secrets to source files.** Config must come from `ConfigService` which reads from `.env`. Add new config keys to the appropriate file in `packages/server/src/common/config/` and export from `config/index.ts`.

### TypeScript Rules

11. **Do not add `@ts-nocheck` to any file.** The existing `@ts-nocheck` files are technical debt, not examples to follow.
12. **Populate DTOs with `class-validator` decorators.** All controller body/query params must use a DTO class annotated with `@IsString()`, `@IsNotEmpty()`, etc.
13. **Do not import `isEmpty` from `class-validator` for utility use.** Use lodash's `isEmpty` instead. The `class-validator` version has different semantics (treats `'0'` as empty).

### Security Rules

14. **Do not add new public routes without explicit `@PublicRoute()` decoration.** All routes are JWT-protected by default via `MixedAuthGuard`.
15. **Do not add new `@TenantAgnosticRoute()` routes without architectural justification.** These routes bypass tenant validation entirely.
16. **File upload endpoints must validate file type and size.** Use `file-type` to check magic bytes, not just the client-supplied MIME type.
17. **Sanitize all HTML content before storing or rendering.** Use `sanitize-html` with a strict allowlist. Never pass user input directly to Pug templates or HTML email bodies.

### Database Rules

18. **New tenant-side migrations go in `packages/server/src/database/tenant/migrations/`.** System-side migrations go in `packages/server/src/database/system/migrations/`. Never mix them.
19. **Do not use `READ_UNCOMMITTED` as a transaction isolation level** without a documented reason. Default to at minimum `READ_COMMITTED`.
20. **Use `withGraphFetched` to prevent N+1 queries.** Whenever loading a list of records that require related data, use `.withGraphFetched('[relation1, relation2]')`.

### Frontend Rules

21. **New server data fetching must use `react-query` hooks only.** Do not add new Redux actions for server data. Redux should hold only UI state.
22. **Do not add new styling libraries.** Use BlueprintJS components and the existing Sass/styled-components utilities.
23. **New forms must use Formik + `yup` schemas.** Do not use uncontrolled inputs or ad-hoc `useState` for form state.
24. **New SDK calls must use the typed generated client** from `shared/sdk-ts`. Use `postFormData` for file uploads, `getBlob` for file downloads, and `rawRequest` for endpoints not yet in the OpenAPI spec.
25. **Do not use `ReactDOM.render`.** Use `ReactDOM.createRoot` for any new entrypoints.

### Testing Rules

26. **Any new NestJS service must have a `*.spec.ts` unit test file** in the same directory.
27. **Use `@nestjs/testing` `Test.createTestingModule`** for unit tests — do not spin up the full application.
28. **E2E tests live in `packages/server/test/`.** The `testRegex` in `jest-e2e.json` must be updated to include new spec files.
29. **The E2E test user (`bigcapital@bigcapital.com` / `123123123`) must be pre-seeded.** If your test requires a different user or tenant state, seed it in the `beforeAll` block.

### SDK Generation Workflow

30. **If you add or modify an API endpoint**, regenerate the OpenAPI schema:
    ```bash
    pnpm run generate:sdk-types
    ```
    This exports the OpenAPI spec from the running server, generates TypeScript types, and rebuilds `sdk-ts`. Update the webapp to use the new types.

### Docker / Deployment Rules

31. **Use `docker-compose.alwathba.yml` for self-hosted builds from source.** Do not modify `docker-compose.prod.yml` (it pulls pre-built Docker Hub images).
32. **The `minio-init-bucket` service is idempotent** (`mc mb --ignore-existing`). Safe to run multiple times.
33. **Healthcheck `depends_on` is mandatory** for any new service that depends on MySQL, Redis, or MinIO. Do not use `sleep`; use proper healthcheck conditions.

---

*This review was produced by static analysis and code inspection only. No commands were run, no files were modified, and no state was changed.*
