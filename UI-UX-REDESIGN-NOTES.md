# InspireX OS — Visual Redesign (Dashboard + Billing)

## Direction
- Near-black / charcoal interface with the logo's sampled lime green (`#73F764`) as the primary brand accent.
- Secondary data colours: blue, purple, amber, teal and red used sparingly for information hierarchy and status meaning.
- More deliberate page composition, larger spacing rhythm, clearer section labels, and compact action-led headers.
- Full-width app shell rather than the previous centered, padded starter layout.

## Changes in this pass
- Reworked the Dashboard greeting into a compact studio overview header with an Operations/Billing switcher and clear Billing action.
- Added more distinct financial metric surfaces, with the primary brand green and restrained blue, purple and amber accents.
- Adjusted Dashboard content proportions for a wider chart workspace and a more useful supporting rail.
- Refined the Billing page heading and overview metric cards; added quick navigation to Quotes and Invoices.
- Added the supplied InspireX logo to the sidebar.
- Added a global appearance control that cycles Dark → Light → System and persists the selection in local storage.
- Added light-theme design tokens and made chart axes/grid and chart tooltip surfaces theme-aware.
- Kept the existing financial data calculations and workflow handlers unchanged.

## Verification
- TypeScript/JSX syntax transpilation passed for the edited TSX files.
- A full production build could not be verified in this environment because dependency installation did not complete; `node_modules` remained incomplete. Run `npm install` and `npm run build` locally before deploying.
