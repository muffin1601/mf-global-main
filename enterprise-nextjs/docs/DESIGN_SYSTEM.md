# CRM design system

Scope: the authenticated CRM and its auth screens. Everything lives in `src/app/globals.css` (tokens + global
component classes) and `src/components/ui/*` (React primitives). The public website never loads this CSS.

## Tokens (`:root`, overridden by `:root[data-theme="dark"]`)

| Group | Tokens | Notes |
|---|---|---|
| Surfaces | `--bg` `--surface` `--surface-2` `--surface-3` `--surface-sunken` `--overlay` | Page canvas → cards → subtle fills → hover |
| Borders | `--border` `--border-strong` | Hairlines vs form-control outlines |
| Text | `--text` `--text-2` `--text-3` `--text-4` | `--text-3` is the lowest tier allowed for text (4.97:1 light, 6.0:1 dark). `--text-4` is **decorative only** (icons, hover borders). |
| Brand | `--primary` `--primary-hover` `--primary-soft` `--primary-soft-text` `--primary-contrast` `--ring` | Enterprise blue `#2453d4` (6.4:1 on white) |
| Semantic | `--success` `--warning` `--danger` `--info` `--violet` `--neutral`, each with `-soft` and `-border` | Badge text on its soft fill is ≥ 5.2:1 in light mode |
| Charts | `--chart-1…8`, `--chart-grid`, `--chart-axis` | Categorical order is fixed. Both themes pass the dataviz palette validator: lightness band, chroma, CVD ΔE, normal-vision ΔE and 3:1 contrast. |
| Shape | `--radius-sm` 6 · `--radius` 8 · `--radius-lg` 12 | Controls use 8, cards/dialogs use 12 |
| Depth | `--shadow-xs/sm/md/lg` | Cards use xs, menus/dialogs use lg |
| Type | `--font-sans` (Inter → Segoe UI → system), `--font-mono` | No webfont is downloaded, so builds work offline and nothing is added to the bundle |
| Layout | `--sidebar-w` 248 · `--sidebar-w-collapsed` 64 · `--header-h` 56 | |

Legacy names (`--ink`, `--muted`, `--line`, `--brand`, `--canvas`) are kept as aliases for older CSS modules.

## Type scale
Body is 14px/1.5. `h1` is 22px/650, `h2` 17px/600 and `h3` 15px/600. Table text is 13px, table headers 12px, and badges and helper text 12px. Numbers use `tabular-nums`.

## Spacing
The scale is based on 4px steps: 4, 6, 8, 10, 12, 14, 16, 20, 24, 28. Pages use 24px/28px padding (16px on phones). Cards use 20px and table cells 9px × 14px.

## Components

| Need | Use |
|---|---|
| Page title, description, actions | `<PageHeader>` (`components/ui/page-header.tsx`) |
| KPI tile, optionally linking to a filtered list | `<MetricCard>` → `.kpis` grid |
| Status chip | `<StatusBadge value kind="lead"\|"call"\|"generic" tone?>`. The tone is derived from the stored value. Values are never renamed. Every badge has a text label and an optional dot, so colour is never the only signal. |
| Dialog | `<Modal>`. It is portalled to `<body>` and handles focus trap, initial focus (`data-autofocus` → first field → dialog), focus return, Esc and backdrop close, scroll lock, and the `busy` lock. It becomes a bottom sheet below 640px. |
| Confirmation | `<ConfirmDialog destructive>`. Replaces every `window.confirm`. |
| Empty table / list | `<EmptyState>` / `<EmptyRow colSpan>` |
| Charts | `components/charts/chart-kit.tsx`: `ChartCard`, `AXIS`, `GRID`, `tooltipProps`, `SERIES` |
| Buttons | `.button` (primary), `.secondary`, `.ghost`, `.danger`, `.secondary.danger`, size `.small`, `.icon`. Icon-only actions use `.icon-btn` with an `aria-label`. |
| Forms | `.form-grid` (+`.cols-2` / `.cols-3`), `.field` > `label` + control + `.hint`/`.error`, `.req` marker |
| Filters | `.filter-bar` (with `.field.grow`) or `.report-filters` for dense report panels; `.search-input` for icon search boxes |
| Tables | `.table-card` > `.section-head` / `.table-scroll` > `table` / `.table-foot` with `.pager`. Classes: `td.num`, `.cell-primary`, `.sub`, `.row-actions`, `.cell-empty` |
| Server-driven table | `<DataTable>` (`components/ui/data-table.tsx`) with `parseTableState` (`lib/table-params.ts`): URL-driven sort, page size, column picker (GET form), compact density. Server Components only |
| Loading | `<Skeleton>`, `<TableSkeleton>`, `<MetricsSkeleton>`, `<PageSkeleton>` (`components/ui/skeleton.tsx`) |
| Error panel | `<ErrorState>` — safe message + optional reference (digest), never raw errors |
| People | `<UserAvatar>` / `<UserChip>`; `initialsOf()` |
| Long forms | `<FormSection>` (fieldset + legend, optional `split` layout) inside `<FormCard>` |
| Search / commands | `<CommandPalette>` (`components/layout/command-palette.tsx`), opened by Ctrl/⌘+K, `/` or the topbar trigger; results from `/api/search` |
| Other | `.segmented` view switcher, `.tabs`/`.tab`, `.callout.tone-*`, `.progress`, `.skeleton`, `.dl-grid` |

## Status tone map (display only)
- **Lead status:** New Lead → info, In Progress → warning, Followed Up → violet, Won Lead → success, Lost Lead → danger.
- **Call status:** Not Called → neutral, Ring → info, Not Interested / Wrong Number → danger, Available After One Month → violet, Follow-up Required → warning, Converted → success.
- **Generic** (vendors, products, users, imports): Active/Enabled/Completed → success, Pending → warning, Inactive/Disabled/Archived → neutral, Blocked/Failed/Error → danger.

## Theme
Light is the default. The header moon/sun button toggles light and dark, and the account menu also offers System. The preference is stored in `localStorage["mf-crm-theme"]`. An inline script, run before content paints (`components/layout/theme.ts`), applies it so the page never flashes. The collapsed-sidebar preference works the same way (`mf-crm-sidebar`).

## Layout rules
- Every page is `<main className="page">` → `PageHeader` → content blocks spaced 16px apart.
- Primary page actions sit top-right in the header. Row actions are icon buttons on the right.
- Lists are paginated, filtered and sorted on the server. The browser never holds more than one page of data.
- Breakpoints: ≥1024 fixed sidebar (collapsible); <1024 off-canvas drawer; <640 single-column forms, two-column KPIs, dialogs as bottom sheets.
