# Walk-in Customers, Variable Costs & Profit Report — Final Plan

A service-based business (tour guide, flight tickets, etc.) needs to record **walk-in** sales
without polluting the customer list, capture a **per-transaction cost** (because every booking's
cost & sell price differs), and report **profit**. This plan is the final, code-grounded design
after deep verification against the current codebase (`file:line` refs throughout).

---

## Locked decisions

| Topic | Decision |
|---|---|
| **Walk-in customer** | `customerId` becomes **optional**; a free-text `customer_name` column is added to `sales_receipts` & `sales_invoices`. Walk-ins stay fully out of the customer list. |
| **Primary document** | **Sale Receipts** for walk-ins (cash, immediate payment); **Sale Invoices** for listed credit customers who may keep a due balance. Both get walk-in support. |
| **Variable cost** | Per-line `cost_rate` on `items_entries`. Income GL becomes **net margin** for non-inventory items; the cost portion credits a single **"Funds held for suppliers"** liability. |
| **Inventory items** | Stay **gross** (existing COGS untouched) — applying net income there would double-count cost in P&L. Margin is gated to non-inventory items only. |
| **Tax / VAT** | Existing VAT feature is **preserved**. Margin is computed tax-exclusive; the tax-payable entry stays gross-based, so the AR debit still ties out. Receipts are tax-free in this codebase. |
| **Profit report** | New **"Sales Profit"** financial report, per booking, driven by `items_entries` + parent docs. (The existing `SalesByItems` report is inventory-only and has no revenue column — it is unsuitable and not reused.) |

---

## Part A — Database migrations & seed

1. `sales_receipts` / `sales_invoices`: `ADD customer_name VARCHAR(255) NULL`
   (new tenant migration). `customer_id` is **already nullable** in both
   (`20200715193633_create_sale_invoices_table.ts`, `20200713213303_create_sales_receipt_table.ts`).
2. `items_entries`: `ADD cost_rate DECIMAL(15,5) NOT NULL DEFAULT 0`
   (model the `rate`-float migration `20231202124014_change_item_entries_rate_to_float.ts`).
3. Seed **"Funds held for suppliers"** account (`type: other-current-liability`) in BOTH
   `packages/server/src/modules/Accounts/Accounts.constants.ts` (`SeedAccounts` L86-406) and
   `database/tenant/seeds/data/accounts.ts`.
4. Backfill `items_entries.cost_rate` from `items.costPrice` where available, else `0`
   (new deployment → minimal historical data).
5. `accounts_transactions.contact_id` is already nullable — GL entries with null contact need **no** migration.

---

## Part B — Walk-in customers (server)

- **DTOs** — `SaleInvoice.dto.ts:45-50`, `SaleReceipt.dto.ts:33-41`:
  - `customerId` → optional; add `customerName` (optional).
  - Cross-field validation: require `customerId` **or** `customerName`.
  - **Coerce `''` → null** (webapp always sends `customer_id: ''`; `@IsOptional` does NOT skip empty strings).
- **Create/Edit services** — `CreateSaleInvoice.service.ts:64-67`, `EditSaleInvoice.service.ts:65-67`,
  `CreateSaleReceipt.service.ts:56`, `EditSaleReceipt.service.ts:55`:
  - Skip `findById().throwIfNotFound()` when `customerId` is null; validate `customerName` instead.
- **DTO transformers** — `CommandSaleInvoiceDTOTransformer.service.ts:110`, `SaleReceiptDTOTransformer.service.ts:92`:
  - `currencyCode` falls back to org base currency (`TenancyContext.getTenantMetadata().baseCurrency`) instead of `customer.currencyCode`.
  - Carry `customerName` into the model.
- **Models** — `SaleInvoice.ts`, `SaleReceipt.ts`: add `customerName` property.
- **Response DTOs** — `SaleInvoiceResponse.dto.ts:40-43`: `customerId: number | null`; add `customerName`.
- **GL** — **no change**:
  - `InvoiceGL.ts:94` posts `contactId: customerId` (null-safe; `accounts_transactions.contact_id` nullable).
  - `SaleReceiptGL.ts` has **no customer reference at all** — receipts are inherently walk-in-clean.
  - `Ledger/Ledger.ts:204-207` `getContactsIds()` filters falsy ids, so walk-in entries never sync to a contact balance (expected).

---

## Part C — Walk-in customers (webapp)

- `InvoiceForm.schema.tsx:11`, `ReceiptForm.schema.tsx:8`: drop `.required()` on `customer_id`.
- `InvoiceFormHeaderFields.tsx` / `ReceiptFormHeaderFields.tsx`: **combo-box** — type to search an existing customer; no match → typed text becomes `customer_name`. Keep the "Create Customer" link.
- Form `utils.tsx` (both): default `customer_name: ''`; convert `''` customer → `null` on submit; force base currency + `exchangeRate: 1` for walk-ins.
- Drawers — `InvoiceDetailHeader.tsx:52-53`, `ReceiptDetailHeader.tsx:49-50`, `CustomerDrawerLink.tsx:19-22`: render `customer_name` when no id; don't open the customer drawer when `customerId` is null.
- Landing columns — `InvoicesLanding/components.tsx:200-207`, `ReceiptsLanding/components.tsx:128-136`: accessor falls back to `customer_name`.

---

## Part D — Crash-guard sweep (walk-ins must not throw 500)

Root cause: many helpers dereference `customer.displayName` / `contactAddressTextFormat(customer)` with no null guard.

- `utils/address-text-format.ts:85-99` — guard null/undefined contact (root of the PDF crash); return `customerName` fallback.
- `SaleInvoices/utils.ts:51` (`transformInvoiceToPdfTemplate`), `SaleReceipts/utils.ts:28` + `:32-38` (PDF + mail transforms).
- `GetInvoicePaymentLink.transformer.ts:52-54,133-136` (payment-link portal — optionally hide for walk-ins).
- `GetSaleInvoiceMailState.transformer.ts:60-61`, `GetSaleReceiptMailState.transformer.ts:51-52`.
- `MailNotification/ContactMailNotification.ts:25-33` — skip `getDefaultMailOptions(customerId)` when customer null.
- `SendInvoiceInvoiceMailCommon.service.ts:109` — use `customerName`.
- Webapp: `InvoiceUniversalSearch.tsx:108`, `ReceiptUniversalSearch.tsx:92`.

> **Note:** `PaymentReceived` (`PaymentReceived.dto.ts:43-48`) requires a customer, so walk-in invoices cannot be paid through the Payments-Received flow. This is intentional — walk-ins pay via the **Receipt** flow (which is GL-clean). No change needed.

---

## Part E — costRate + net-margin GL (server)

- **Model** — `TransactionItemEntry/models/ItemEntry.ts`:
  - Add `costRate` property.
  - Add virtual **`costAmount = costRate * quantity`**.
  - Add virtual **`margin = totalExcludingTax - costAmount`** (inherits line discount + tax-exclusive base).
  - ⚠️ Do **NOT** use `(rate - costRate) * qty` — it ignores the line `discountAmount` and inclusive-tax, breaking the debit/credit tie-out.
  - Register `costAmount` and `margin` in `virtualAttributes` (L63-85).
- **DTO + types** — `TransactionItemEntry/dto/ItemEntry.dto.ts` (next to `rate` L31-38), `ItemEntry.types.ts` (`IItemEntryDTO` L3-19): add `costRate`.
- **Default injection** — `Items/ItemsEntries.service.ts:222-241` (`setItemsEntriesDefaultAccounts`, the shared choke point for both docs): default `costRate = item.costPrice` for **non-inventory** lines only.
- **GL builders**:
  - `SaleInvoices/ledger/InvoiceGL.ts:106-124` — income credit = `entry.margin * exchangeRate` for non-inventory lines with `costRate > 0`; add new liability **credit** entry (`entry.costAmount * exchangeRate`); add `setSuppliersFundsAccountId()`.
  - `SaleReceipts/ledger/SaleReceiptGL.ts:72-89` — same (note: receipt income uses `entry.item.sellAccountId`, L81).
- **Wiring** — `SaleInvoices/ledger/InvoiceGLEntries.ts:41-56`, `SaleReceipts/ledger/SaleReceiptGLEntries.ts:34-44`: `findOrCreate` the liability account and call `.setSuppliersFundsAccountId(...)`.
- **Repository** — `Accounts/repositories/Account.repository.ts`: add `findOrCreateSuppliersFundsAccount()` modeled on `findOrCreateUnearnedRevenue` (L215-235).
- **Seeds** — add the account constant in `Accounts.constants.ts` and `database/tenant/seeds/data/accounts.ts` (Part A.3).
- **Credit notes** — `CreditNotes/commands/CreditNoteGL.ts:105`: reverse margin **and** liability on credit notes (else refunds create unbalanced entries).
- **Gate** — margin + liability apply only when `item.type !== 'inventory'` and `costRate > 0`. Inventory items keep gross income + existing COGS (`ProfitLossSchema.ts:44-48` would otherwise subtract cost twice).

**Balanced GL for a sample receipt** (service, rate 100, cost 60, qty 1, FX 1):

| # | Account | Dr | Cr |
|---|---|---|---|
| 1 | Cash/Deposit (`depositAccountId`) | 100 | |
| 2 | Income (`sellAccountId`) | | 40 |
| 3 | Funds held for suppliers (new liability) | | 60 |

For invoices with VAT, tax-payable credit (gross-based) is added; `margin` is tax-exclusive, so AR debit still equals income + tax + liability.

---

## Part F — "Sales Profit" report (server)

New module at `packages/server/src/modules/FinancialStatements/modules/SalesProfit/` — 13 files cloned from `SalesByItems/` and renamed: `types.ts`, `SalesProfitQuery.dto.ts`, `SalesProfitService.ts`, `SalesProfit.ts`, `SalesProfitTable.ts`, `SalesProfitTableInjectable.ts`, `SalesProfitMeta.ts`, `SalesProfitApplication.ts`, `SalesProfitExport.ts`, `SalesProfitPdfInjectable.ts`, `SalesProfit.controller.ts` (`/reports/sales-profit`), `SalesProfit.module.ts`, `SalesProfitResponse.dto.ts`, `utils.ts`, `constants.ts`.

Register the module in `FinancialStatements.module.ts:21-41`.

**Data query (gotcha-aware):**
- Query `ItemEntry` where `referenceType IN ('SaleInvoice','SaleReceipt')` + date-range filter from the parent doc + `withGraphFetched('item')`.
- ⚠️ **Do NOT rely on `ItemEntry.invoice`/`receipt` relations** (`ItemEntry.ts:214-251`) — they join only on `referenceId`, so an invoice and a receipt sharing a numeric id cross-join the wrong parent.
- **Manual two-query merge**: collect parent ids per `referenceType`, fetch `SaleInvoice`/`SaleReceipt` with `withGraphFetched('customer')`, then map `referenceId → { date, number, customerName = displayName ?? customer_name }`.
- Row mapper: `revenue = rate * qty`, `cost = cost_rate * qty`, `profit = revenue − cost`, `margin% = profit / revenue`. Use `FinancialSheet.formatNumber` / `getDateMeta` and `sumBy` totals. Emit `events.reports.onSalesProfitViewed`.

---

## Part G — "Sales Profit" report (webapp + SDK)

- Page container `packages/webapp/src/containers/FinancialStatements/SalesProfit/` (11 files cloned from `SalesByItems/`), incl. PDF preview dialog (`constants/dialogs.ts:81`).
- Hooks: `hooks/query/FinancialReports/use-sales-profit.ts` (5 hooks, url `/reports/sales-profit`) + `types.tsx:26` key + `index.ts`.
- Registration points:
  - `routes/dashboard.tsx` (~319) — new `/financial-reports/sales-profit` route.
  - `constants/financialReportsMenu.tsx` (~106) — menu entry.
  - `constants/sidebarMenu.tsx` (~712) — sidebar entry.
  - `constants/abilityOption.tsx:166` — `READ_SALES_PROFIT`.
  - `constants/permissionsSchema.tsx:603-607` — permission block (+ server CASL abilities).
- i18n keys in `lang/{en,es,ar,sv}/index.json` (title, desc, sidebar, permission, column labels).
- SDK: `shared/sdk-ts/src/reports/sales-profit.ts` + `reports/index.ts:14`; run `pnpm run generate:sdk-types`.

---

## Implementation order

1. **Migrations + seed + backfill** (Part A).
2. **Server walk-in** (Part B).
3. **Crash-guard sweep** (Part D).
4. **Webapp walk-in** — schema, fields, utils, drawers, search, landing (Part C).
5. **costRate model/DTO + margin GL + liability + credit notes** (Part E).
6. **Sales Profit server module** (Part F).
7. **Sales Profit webapp + SDK + i18n + permissions** (Part G).
8. **Tests + `pnpm run typecheck` + `pnpm run lint`**.

---

## Tests

- Create a **receipt** with a walk-in customer (no `customerId`, with `customerName`).
- Create an **invoice** walk-in and one for a listed credit customer.
- Add `costRate` on service lines; assert GL balances (Cash = Income + Liability; AR = Income + Tax + Liability for invoices).
- Credit-note reversal of a margin invoice balances.
- Edit re-rewrite of a margin line is deterministic (`costRate` defaults from `item.costPrice`).
- Walk-in PDF download / mail / universal search no longer 500.
- Run Sales Profit report over a date range; verify per-booking revenue/cost/profit/margin and totals.

---

## Top risks & mitigations

| # | Risk | Mitigation |
|---|---|---|
| R1 | P&L double-counts cost for inventory items | Margin gated to non-inventory items only |
| R2 | `customer_id: ''` rejected by `@IsOptional` | Explicit `''`→null coercion in DTO **and** webapp |
| R3 | PDF / mail / search 500 on null customer | Part D guard sweep |
| R4 | Tax base vs net income (`SalesTaxLiabilitySummary`) | Tax-payable stays gross; margin tax-exclusive; caveat documented |
| R5 | Credit note unbalances refunds | Reverse margin **and** liability |
| R6 | Report cross-joins wrong parent | Manual id-merge, not the ambiguous `invoice`/`receipt` relations |
| R7 | Edited / legacy lines get `cost_rate = 0` | Deterministic default from `item.costPrice` + backfill migration |
| R8 | Document totals gross vs P&L net | Intended — document for users; UI keeps gross totals |
