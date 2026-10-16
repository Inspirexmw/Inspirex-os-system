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
- **Working Capital is for studio overhead only** (subscriptions, transport, bills, equipment, other studio expenses), funded by manual top-ups and month-end transfers from Retained Profit.
- **Billing is source of truth** for cash flow — payments recorded on invoices create the Working Capital inflow and the transfer to Retained Profit.
- **Multiple currencies:** MWK (primary), USD, ZAR; exchange rates stored per billing document

### PDF & Approval

Quotes generate inline PDFs via jsPDF (`Billing.tsx`). The approval page (`src/sections/` or inlined in `App.tsx`) is a public, token-gated view — no authentication required — that lets clients approve/decline and download a PDF.

### Deployment

Deployed to Vercel. [`vercel.json`](vercel.json) sets CSP headers permitting `unsafe-eval` and `unsafe-inline` (required by React/Vite in production) and `blob:`/`data:` image sources (required by jsPDF).
