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
- `members` — team profiles, stipends, roles
- `projects` — revenue splits, bonus distributions
- `workLog` / `taskProjects` / `commitmentScores` — work tracking and scoring
- `billingData` — clients, quotes, invoices, receipts, expenses, retainers, recurring, tax
- `workingCapital` / `bonusBank` — financial ledgers and runway
- `settings` — company config, revenue split ratios, scoring weights, currency

### Routing

There is no router library. `App.tsx` renders one of the 10 section components based on `currentView` state. The exception is the public `/approval` route, which is handled by checking `window.location.pathname` at startup and rendering `<ApprovalPage>` outside the authenticated shell.

### Section Components

Each section in [`src/sections/`](src/sections/) is a self-contained feature module. Billing is the largest (245 KB) and has its own internal sub-navigation. Sections receive state and dispatch from `useAppState`.

| Section | Purpose |
|---|---|
| `Dashboard.tsx` | Stat cards, cash flow chart, activity feed, team rail |
| `Billing.tsx` | Full billing lifecycle — quotes to receipts, expenses, tax |
| `ProjectCalculator.tsx` | Revenue split & bonus distribution per project |
| `WorkLog.tsx` | Daily task logging with dimension scores |
| `CommitmentTracker.tsx` | Quarterly commitment scoring & point weighting |
| `MonthlySummary.tsx` | Stipend coverage status, net company fund |
| `TasksAndScoring.tsx` | Project-based task assignment & member scoring |
| `TeamManagement.tsx` | Member profiles, stipends, active status |
| `Settings.tsx` | Company config, scoring weights, contribution bank tiers |
| `WorkingCapital.tsx` | WC transactions, balance, and runway calculations |

### UI Components

[`src/components/ui/`](src/components/ui/) holds 65+ shadcn-style components built on Radix UI + Tailwind CSS. Path alias `@/*` resolves to `src/*`. The design system uses HSL CSS variables in dark mode (primary green: `#73F764`), Inter font, and Framer Motion for page transitions.

### Key Business Rules

- **Revenue split:** Company 60% / Bonus Pool 40% (configurable in Settings)
- **Stipend protection:** Full payout when revenue ≥ stipends; partial (70%) when revenue ≥ 70% of stipends
- **Billing is source of truth** for cash flow — project revenue flows from paid invoices
- **No score multipliers or penalties** — scoring is additive only
- **Multiple currencies:** MWK (primary), USD, ZAR; exchange rates stored per billing document

### PDF & Approval

Quotes generate inline PDFs via jsPDF (`Billing.tsx`). The approval page (`src/sections/` or inlined in `App.tsx`) is a public, token-gated view — no authentication required — that lets clients approve/decline and download a PDF.

### Deployment

Deployed to Vercel. [`vercel.json`](vercel.json) sets CSP headers permitting `unsafe-eval` and `unsafe-inline` (required by React/Vite in production) and `blob:`/`data:` image sources (required by jsPDF).
