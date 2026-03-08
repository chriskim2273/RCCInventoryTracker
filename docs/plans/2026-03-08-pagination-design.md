# Pagination Design

## Overview
Add server-side pagination (50 items/page) with classic page number navigation to all list pages. Fuse.js fuzzy search remains as a client-side fallback mode.

## Shared Pagination Component
Reusable `<Pagination>` component: page numbers, prev/next buttons, "showing X-Y of Z" text. Tailwind + SBU brand styling.

## Pages to Update

| Page | Records | Server-side filters | Search |
|------|---------|---------------------|--------|
| Items.jsx | Items | Category, status, location | Normal: server-side `.ilike()`. Fuse.js mode: client-side fallback |
| ReorderRequests.jsx | Requests | Status, category, location, priority | Fuse.js client-side fuzzy search + server-side filtered browsing |
| LocationExplorer.jsx | Items at location | None (location is context) | None |
| AdminPanel.jsx | Deleted items, checkout history, admin comments | Tab-specific | None |

## How It Works

### Normal mode (server-side)
- Filters + text search (`.ilike()`) + sort sent as Supabase query params
- Query uses `.range(from, to)` + `{ count: 'exact' }` for one page + total count
- Page state stored in URL search params for browser back/forward support

### Fuse.js / AI search mode (client-side fallback)
- Fetches all matching items via `fetchAllRows()`
- Fuse.js filters client-side, then paginates the result array in memory
- Pagination component works the same way visually

## Defaults
- 50 items per page

## Removals
- `fetchAllRows()` calls in normal browsing (fetch one page at a time instead)
- Scroll persistence via sessionStorage in Items.jsx (pagination replaces it)
