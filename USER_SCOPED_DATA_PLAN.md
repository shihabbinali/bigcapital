# USER_SCOPED_DATA_PLAN.md

## Per-User Scoped Data & Reporting — Implementation Plan

**Branch:** `feature/bun-runtime`
**Date:** 2026-08-13
**Status:** Verified against codebase — pending 4 client decisions before implementation

## 1. Requirement

The client wants each (non-admin) user to see **only the records they created** — items, invoices, receipts, and any other resource — and financial reports to be **calculated from that same user's own work**. Admin users continue to see everything.

> "Each user will see only items which that user created — invoices or any item, only what he generated. Reports should be calculated by the work he has done."

## 2. Findings — what already exists

### 2.1 Data foundation (partial)

| Table | `user_id` column | Model `userId` | Set on create | User filter on list |
|---|---|---|---|---|
| `items` | ✅ (migration `20190822214306...:44`) | ✅ `Item.ts:37` | ❌ **never** (`CreateItem.service.ts:84-90`) | ❌ |
| `sale_invoices` | ✅ (`20200715193633...:27`) | ✅ `SaleInvoice.ts:57` | ✅ `CommandSaleInvoiceDTOTransformer.service.ts:123` | ❌ |
| `bills` | ✅ (`20200719152005...:24`) | ✅ `Bill.ts:43` | ✅ `BillDTOTransformer.service.ts:115` | ❌ |
| `manual_journals` | ✅ (`20200105195823...:14`) | ✅ | ✅ `CreateManualJournal.service.ts:75` | ❌ |
| `inventory_adjustments` | ✅ | ✅ | ✅ `CreateQuickInventoryAdjustment.service.ts:74` | ❌ |
| `sales_receipts` | ❌ **no column** (`20200713213303`) | ⚠️ `SaleReceipt.ts:58` declared but column missing | ❌ | ❌ |
| `sales_estimates`, `payment_receives`, `bills_payments`, `credit_notes`, `vendor_credits`, `expenses`, `cashflow_transactions`, `items_categories` | ✅ columns | ✅ models | ❌ not stamped (some commented out) | ❌ |
| `accounts`, `contacts` (customers/vendors) | ❌ none | ❌ | — | — |

- **Key gap:** the `items.user_id` column exists but is **never written** — it is a dead column. Invoices/bills/journals/adjustments are the only resources that stamp the creator.
- **Latent bug:** `sales_receipts` has **no `user_id` column** yet `SaleReceiptGL.ts:71` writes `saleReceipt.userId`, so receipts today emit NULL into GL.

### 2.2 Ownership identity semantics

- The stored `user_id` on existing records is the **`SystemUser.id`** (system DB), not the tenant-local `users.id` (which links via `users.system_user_id`).
- `credit_notes.user_id` / `vendor_credits.user_id` FKs reference tenant `users.id` — an inconsistency, but those columns are unpopulated so it is latent.

### 2.3 Runtime auth / role resolution (usable as-is)

- Current user id available in any service: `cls.get('userId')` (SystemUser.id) or `await tenancyContext.getSystemUser().id`.
- Admin detection: `tenantUser.role.slug === 'admin'` (`TenantAbilities.ts:26`, `Dashboard.service.ts:73`); roles seeded `admin`/`staff` (`database/tenant/seeds/core/20210810121909_seed_roles.ts:11-26`).
- Full guard chain already builds CASL abilities and attaches `request.ability` (`Authorization.guard.ts:27-50`, `Permission.guard.ts:23-57`).
- **No existing row-level scoping:** no CASL `conditions`, no `where('user_id', …)` anywhere in listings or reports. This feature is net-new.

### 2.4 Report data flows

- **Sales Profit** (`SalesProfitService.ts`): queries `items_entries` (`referenceType IN SaleInvoice|SaleReceipt`) → collects parent ids → queries invoices/receipts with date filter → in-memory entry filter (`:116-125`). **Single chokepoint:** add `where('userId',…)` at `:76` (invoice `onBuild`) and `:98` (receipt `onBuild`); `filteredEntries` at `:116` prunes orphaned entries automatically; all formats (JSON/table/CSV/XLSX/PDF) flow through `SalesProfitReport` so one injection covers everything.
- **GL-based reports** (BalanceSheet, ProfitLoss, GL, Journal, TrialBalance, CashFlow, SalesTaxLiability, TransactionsBy*, Balance Summaries, AR/AP Aging — ~13): aggregate `accounts_transactions`, which **has a `user_id` column** (`migration 20200104232647...:23`) but only populated when the parent document stamped it. Needs a `filterByUserId` modifier + per-repository `onBuild` call.
- **Inventory-based reports** (SalesByItems, PurchasesByItems, InventoryValuation, InventoryItemDetails): read `inventory_transactions` / `inventory_cost_lot_tracker`, which have **no user lineage** at all — needs schema + propagation or a join through `items_entries.entryId → parent`.

## 3. Proposed implementation plan

### Phase 1 — Schema & ownership stamping (write-side)

1. **Migration:** add nullable, indexed `user_id` to `sales_receipts`.
2. Stamp `userId` on create in every create flow, resolving via `TenancyContext.getSystemUser().id` (pattern already used by `CommandSaleInvoiceDTOTransformer.service.ts:64`):
   - **Items:** inject `TenancyContext` into `CreateItem.service.ts`; set `userId` in `transformNewItemDTOToModel` (`:84-90`).
   - **Sale receipts:** `SaleReceiptDTOTransformer.service.ts:94-109`.
   - Estimates, credit notes, vendor credits, expenses (uncomment `CommandExpenseDTO.transformer.ts:97-101`), payment receives, bill payments, cashflow (fix the unused `userId` param), item categories.
3. **Preserve creator on edit** — do not reassign `userId` on update.
4. **Verification:** GL propagation (`InvoiceGL`, `SaleReceiptGL`, `ExpenseGL`, …) will then carry the owner into `account_transactions`.

### Phase 2 — Server read-side per-user scoping

1. Build one reusable helper (e.g. `UserScopedQuery` / `applyUserScope(builder)`):
   - Resolve current user (`cls.get('userId')`).
   - Resolve role via `tenantUserModel().query().findOne('systemUserId', userId)` → `role.slug`.
   - Non-admin → `.where('user_id', userId)`; admin → no filter.
   - **Note:** none of the 17 listing services inject `TenancyContext`/`ClsService` today (e.g. `GetItems.service.ts:14-20` injects only `dynamicListService`, `transformer`, model). The helper therefore requires a constructor change in every listing/detail service it is applied to — plan for that wiring up front.
2. Apply in all listing services (`GetItems.service.ts`, `GetSaleInvoices.ts`, `GetSaleReceipts`, …).
3. Apply in single-record getters (`GetItem.service.ts`, `GetSaleInvoice.service.ts`, …) — behavior depends on Decision 3 below.
4. Add `filterByUserId(query, userId)` modifier to `AccountTransaction.model.ts` (mirroring `filterByBranches` at `:217-221`).

### Phase 3 — Report scoping

1. **Sales Profit:** `where('userId',…)` at `SalesProfitService.ts:76` (invoice `onBuild`) and `:98` (receipt `onBuild`) — parent queries; in-memory filter at `:116` handles the rest automatically.
   - **Optimization note:** the *entries* query at `SalesProfitService.ts:52-57` still loads **all** users' item entries unscoped (pruned later by the parent filter at `:116`). Functionally correct, but a non-admin's report does a full-table read. If data grows, optionally push the user filter into the entries query too (e.g. `whereExists` against the parent's `user_id`). Not required for correctness.
2. **GL-based reports:** apply `filterByUserId` in each of the ~13 `account_transactions`-based repositories.
3. **Inventory-based reports** (scope per Decision 4): either add `user_id` to `inventory_transactions` + propagate at write time (`InventoryCost/utils.ts:24-57`), or join `inventory_transactions.entryId → items_entries → parent.user_id`.
4. Add the missing RBAC guard to the Sales Profit controller (currently no `@UseGuards` / `@RequirePermission` — unlike every other report). Add missing translation entry to `i18n/en/ability.json` for key `ability.sales_profit_report` (key is defined in `AbilitySchema.ts:281` but absent from the JSON file).

### Phase 4 — Legacy data backfill

Per Decision 2: backfill `NULL user_id` rows on `items` / `sales_invoices` / `sales_receipts` (and other in-scope tables) to the tenant owner's `SystemUser.id`, or leave them admin-only.

### Phase 5 — Webapp & tests

- Webapp generally needs **no changes** (server enforces scoping). Optionally expose the current user's role in the `/api/dashboard/boot` response for UX.
- Unit + e2e: non-admin sees only own records, admin sees all, reports reflect only the user's work for each format.

## 4. Files to be created / modified (high-level)

**New:** migration(s), reusable scope helper, `USER_SCOPED_DATA_PLAN.md`.
**Modified:** `CreateItem.service.ts`, `SaleReceiptDTOTransformer.service.ts`, expense/credit-note/vendor-credit/payment bill-payment/cashflow transformers, item category create, `AccountTransaction.model.ts`, all 17 listing services, ~15 report repositories/injectables, `SalesProfit.controller.ts` (RBAC), server i18n `ability.json`, webapp `abilityOption.tsx`/`permissionsSchema.tsx` (only to add/verify permission wiring).

## 5. Open decisions (need client call before finalizing)

> **Priority:** Decisions 2 and 4 are the real implementation blockers — both change scope significantly (legacy backfill migration; inventory schema + write-path change). Lock these two before any code starts. Decisions 1 and 3 are simpler product calls that can be settled alongside.

1. **Resource scope:** everything (all transaction types) or just items + invoices + receipts + reports?
2. **Legacy `NULL user_id`:** backfill to tenant owner (all users see old data) or admin-only (old data hidden from non-admins)?
3. **Single-record detail views:** 404/403 for non-owners, or only hide from listings?
4. **Inventory-based reports:** full implementation now, or defer?