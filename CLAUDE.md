# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # Type-check (tsc -b) then Vite build
npm run lint       # ESLint with TypeScript rules
npm run preview    # Serve the production build locally
```

There is no test runner configured — all validation is type-checking (`tsc -b`) and ESLint.

## Architecture

**InspireX Studio Lab** is a single-page React 19 + Vite + TypeScript app. There is no backend — all state persists to `localStorage` under the key `inspirex_os_v1` (settings at `inspirex_settings`).

### State Management

All application state lives in [`src/hooks/useAppState.tsx`](src/hooks/useAppState.tsx). It is a large (~45 KB) React Context with 100+ action types. Every feature section consumes this context via the `useAppState` hook. There is no external state library (no Redux, Zustand, etc.).

Key state domains:
- `billing` — clients, quotes, invoices, receipts, expenses (incl. contractor costs), retainers, recurring, tax
- `wcBalance` / `wcTransactions` — Working Capital ledger
- `retainedProfit` — accumulated profit: client payments in, project costs out
- `settings` — company config, currency, working-capital auto-transfer

Legacy domains still exist in the state shape so old saved data and backups keep loading, but no UI uses them any more: `members`, `projects`, `workLog`, `taskProjects`, `commitmentScores`, `bonusBank*`, revenue-split / scoring / stipend settings. Do not build new features on them.

### Routing

There is no router library. `App.tsx` renders one of 5 section components based on `currentView` state (`dashboard`, `billing`, `summary`, `capital`, `settings`). The exception is the public approval page, reached via a `#approve/...` URL hash.

### Section Components

Each section in [`src/sections/`](src/sections/) is a self-contained feature module. Billing is the largest (245 KB) and has its own internal sub-navigation. Sections receive state and dispatch from `useAppState`.

| Section | Purpose |
|---|---|
| `Dashboard.tsx` | Received/invoiced/profit cards, cash flow chart, recent invoices, activity feed |
| `Billing.tsx` | Full billing lifecycle — quotes to receipts, expenses, tax |
| `MonthlySummary.tsx` | Payments received and project costs per month, CSV export |
| `WorkingCapital.tsx` | WC transactions, balance, transfers from Retained Profit |
| `Settings.tsx` | Company config, working-capital auto-transfer, data export/import |

### UI Components

[`src/components/ui/`](src/components/ui/) holds 65+ shadcn-style components built on Radix UI + Tailwind CSS. Path alias `@/*` resolves to `src/*`. The design system uses HSL CSS variables in dark mode (primary green: `#73F764`), Inter font, and Framer Motion for page transitions.

### Key Business Rules

- **Every client payment goes 100% to Retained Profit first.** No revenue split, no bonus pool, no scoring, no team stipends.
- **Project costs come out of the project's money, not Working Capital.** Recording a cost under Billing → Project Costs (contractors, printing, assets, etc.) reduces Retained Profit by that amount (stored on the expense as `profitDeduction`) and creates no Working Capital entry. Editing or deleting the cost reverses it. Profit for a month = payments received − project costs (`src/lib/profit.ts`). Costs recorded before this rule have no `profitDeduction` and keep their old Working Capital outflow.
- **Deleting reverts everything.** Deleting a payment, a receipt (undoes all payments on it), an invoice (undoes its payments) or a project cost asks for a reason and reverses the invoice status/balance, Working Capital, Retained Profit and the receipt (`reversePayments` in `Billing.tsx`, helpers in `src/lib/payment-reversal.ts`). New Working Capital entries are tagged with `paymentId`; older ones are matched by invoice number, date and amount. A record of each deletion with its reason is added to notifications.
- **Payments can be edited** (pencil icon beside each payment, reason required): `editPayment` swaps the old Working Capital lines for new ones and updates the invoice, receipt and figures together.
- **Deleted items go to a trash** (Billing → Deleted items, `state.trash`). Every delete of a payment, receipt, invoice, quote/proforma or project cost stores a snapshot; Restore (or the Undo button on the delete toast) re-applies it via `restoreTrashItem`, which re-writes Working Capital / Retained Profit / the receipt as if it had just been entered.
- **Dashboard figures auto-fit their cards** (`src/components/ui/figure.tsx`): each figure measures the space it has and shrinks to fit; if it would need to go below a readable size it switches to short form (MK 12.3B) with the exact value in a tooltip. The four stat cards sit in a full-width row above the chart.
- **Working Capital ledger lock:** lines created by project payments or costs (`paymentId`, or auto-generated `client_payment` / `client_to_retained` / `project_expense` / `bonus_to_bank`) show a lock instead of edit/delete (`projectLink` in `WorkingCapital.tsx`). They are changed on the invoice or under Billing → Project Costs. Manual top-ups, overhead and month-end transfers stay editable. The manual form no longer offers "Client Payment".
- **Payments open in the invoice's own currency and rate** (USD/ZAR), with a live MWK equivalent; the rate is editable.
- **Working Capital is for studio overhead only** (subscriptions, transport, bills, equipment, other studio expenses), funded by manual top-ups and month-end transfers from Retained Profit.
- **Billing is source of truth** for cash flow — payments recorded on invoices create the Working Capital inflow and the transfer to Retained Profit.
- **Multiple currencies:** MWK (primary), USD, ZAR; exchange rates stored per billing document

### PDF & Approval

Quotes generate inline PDFs via jsPDF (`Billing.tsx`). The approval page (`src/sections/` or inlined in `App.tsx`) is a public, token-gated view — no authentication required — that lets clients approve/decline and download a PDF.

### Deployment

Deployed to Vercel. [`vercel.json`](vercel.json) sets CSP headers permitting `unsafe-eval` and `unsafe-inline` (required by React/Vite in production) and `blob:`/`data:` image sources (required by jsPDF).
