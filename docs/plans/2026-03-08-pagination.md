# Pagination Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add server-side pagination (50 items/page) with classic page number navigation to Items, LocationExplorer, ReorderRequests, and AdminPanel pages. Fuse.js/AI search remains as client-side fallback.

**Architecture:** Create a shared `<Pagination>` component. Each page gets a `fetchPage()` function that builds a Supabase query with `.range()` and `{ count: 'exact' }`. Filters become query params sent to Supabase. When Fuse.js or AI search is active, all items are fetched client-side and paginated in memory using the same Pagination component.

**Tech Stack:** React 19, Supabase JS 2.76, Tailwind CSS, Lucide React icons

---

### Task 1: Create shared Pagination component

**Files:**
- Create: `src/components/Pagination.jsx`

**Step 1: Create the Pagination component**

```jsx
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export default function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }) {
  if (totalPages <= 1) return null

  const from = (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalItems)

  // Generate page numbers to show (max 5 visible)
  const getPageNumbers = () => {
    const pages = []
    let start = Math.max(1, currentPage - 2)
    let end = Math.min(totalPages, start + 4)

    // Adjust start if we're near the end
    if (end - start < 4) {
      start = Math.max(1, end - 4)
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      <p className="text-sm text-muted-foreground">
        Showing {from}-{to} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-2 text-sm border rounded-md bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 text-sm border rounded-md bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {getPageNumbers().map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              page === currentPage
                ? 'bg-primary text-primary-foreground'
                : 'border bg-background hover:bg-muted'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 text-sm border rounded-md bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-2 text-sm border rounded-md bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/Pagination.jsx
git commit -m "feat: add shared Pagination component"
```

---

### Task 2: Add server-side pagination to Items.jsx

This is the most complex page — it has server-side mode (normal browsing with filters) and client-side fallback mode (Fuse.js search and AI search).

**Files:**
- Modify: `src/pages/Items.jsx`

**Step 1: Implement dual-mode pagination**

Key changes:
1. Add `page` URL param for current page
2. Replace `fetchData` with `fetchPage` that uses `.range()` + `{ count: 'exact' }` and applies server-side filters
3. Keep `fetchAllForSearch` that loads all items for Fuse.js/AI search mode
4. Categories, locations, and checkout logs still fetch all (they're small datasets used for filters/dropdowns)
5. Remove scroll persistence (pagination replaces it)
6. Paginate client-side search results in memory
7. Reset to page 1 when any filter changes

**Server-side query building:**
- Category filter: `.eq('category_id', selectedCategory)`
- Location filter: `.in('location_id', sublocationIds)` (sublocation IDs computed client-side from locations data)
- Status filter: requires checkout data, so keep status filtering client-side OR move to a DB view. For simplicity, keep status filter as client-side post-filter on the current page. NOTE: This means status filter accuracy is page-scoped. If this is unacceptable, we skip server-side for status filter and fall back to client-side when status is set.
- Search (non-fuzzy): `.or('name.ilike.%query%,brand.ilike.%query%,serial_number.ilike.%query%,description.ilike.%query%,model.ilike.%query%')`

**Decision on status filter:** Since status depends on checkout_logs (a separate table), and Supabase PostgREST can't easily filter by computed fields across tables, we'll use a **hybrid approach**:
- When NO status filter is active: server-side pagination with `.range()` + count
- When status filter IS active: fetch all items server-side (no pagination range), filter client-side by status, then paginate the result in memory

This avoids showing inaccurate counts while keeping server-side pagination for the common case.

**Implementation approach:**

```jsx
// In Items.jsx - key state changes:
const currentPage = parseInt(searchParams.get('page')) || 1
const PAGE_SIZE = 50

// New: track total count for server-side pagination
const [totalCount, setTotalCount] = useState(0)
// New: track whether we're in client-side mode (search/status filter active)
const [isClientMode, setIsClientMode] = useState(false)

// fetchPage: server-side paginated fetch
const fetchPage = async (page) => {
  let query = supabase
    .from('items')
    .select('*, category:categories(name, icon), location:locations(name, path)', { count: 'exact' })
    .is('deleted_at', null)

  // Apply server-side filters
  if (selectedCategory) {
    query = query.eq('category_id', selectedCategory)
  }
  if (selectedLocation && sublocationIds.length > 0) {
    query = query.in('location_id', sublocationIds)
  }
  if (searchQuery && !useAiSearch) {
    // Simple ilike search for server-side
    const q = `%${searchQuery}%`
    query = query.or(`name.ilike.${q},brand.ilike.${q},serial_number.ilike.${q},description.ilike.${q},model.ilike.${q}`)
  }

  query = query.order('created_at', { ascending: false })

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  query = query.range(from, to)

  const { data, count, error } = await query
  // ... handle results, compute availability from checkout_logs
}
```

**Page change handler:**
```jsx
const handlePageChange = (page) => {
  updateParams({ page: page > 1 ? page : null })
}
```

**Reset page on filter change:**
Any time category, status, location, or search changes, reset page to 1.

**Rendering: add Pagination component after the item list:**
```jsx
import Pagination from '@/components/Pagination'

// After the mobile/desktop list rendering:
<Pagination
  currentPage={currentPage}
  totalPages={Math.ceil(totalCount / PAGE_SIZE)}
  totalItems={totalCount}
  pageSize={PAGE_SIZE}
  onPageChange={handlePageChange}
/>
```

**Update header count:** Change `Items ({filteredItems.length})` to `Items ({totalCount})` for server-side mode, or `Items ({filteredItems.length})` for client-side mode.

**Bulk select considerations:** Select-all should only select items on the current page. The `toggleSelectAll` already uses `filteredItems` which will now be the current page's items.

**Step 2: Commit**

```bash
git add src/pages/Items.jsx
git commit -m "feat: add server-side pagination to Items page"
```

---

### Task 3: Add server-side pagination to LocationExplorer.jsx

**Files:**
- Modify: `src/pages/LocationExplorer.jsx`

**Step 1: Implement pagination for items at a location**

Key changes:
1. Add `page` state (not in URL since locationId is the URL param)
2. Replace `fetchAllRows(itemsQuery)` with `.range()` + `{ count: 'exact' }`
3. Client-side item search (fuzzySearchItems) falls back to fetching all items, then paginating in memory
4. Reset page to 1 when navigating to a new location or toggling sublocation filter

```jsx
import Pagination from '@/components/Pagination'

const PAGE_SIZE = 50
const [currentPage, setCurrentPage] = useState(1)
const [totalItemCount, setTotalItemCount] = useState(0)
const [isSearchMode, setIsSearchMode] = useState(false)
const [allItemsForSearch, setAllItemsForSearch] = useState([])

// In fetchLocationData, replace the items query:
let itemsQuery = supabase
  .from('items')
  .select('*, category:categories(name, icon), location:locations(name, path)', { count: 'exact' })
  .is('deleted_at', null)

if (locationId) {
  itemsQuery = itemsQuery.in('location_id', locationIdsToQuery)
} else {
  itemsQuery = itemsQuery.is('location_id', null)
}

itemsQuery = itemsQuery.order('name')

if (!itemSearchQuery.trim()) {
  // Server-side pagination
  const from = (currentPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, count } = await itemsQuery.range(from, to)
  setItems(data || [])
  setTotalItemCount(count || 0)
} else {
  // Client-side: fetch all for fuzzy search
  const { data } = await fetchAllRows(itemsQuery)
  setAllItemsForSearch(data || [])
  setTotalItemCount(data?.length || 0)
}
```

**Refetch when page changes:**
```jsx
useEffect(() => {
  if (!itemSearchQuery.trim()) {
    fetchLocationData()
  }
}, [currentPage])
```

**Reset page on location change:**
Already handled by existing `useEffect` that resets `itemSearchQuery` on `locationId` change — add `setCurrentPage(1)` there.

**Rendering: add Pagination after items grid:**
```jsx
<Pagination
  currentPage={currentPage}
  totalPages={Math.ceil(totalItemCount / PAGE_SIZE)}
  totalItems={totalItemCount}
  pageSize={PAGE_SIZE}
  onPageChange={setCurrentPage}
/>
```

**Step 2: Commit**

```bash
git add src/pages/LocationExplorer.jsx
git commit -m "feat: add server-side pagination to LocationExplorer"
```

---

### Task 4: Add client-side pagination to ReorderRequests.jsx

ReorderRequests uses Fuse.js fuzzy search heavily and has complex client-side sorting (by status + priority). Converting filters to server-side would require reworking the sort logic. Since reorder requests are typically in the hundreds (not thousands), **client-side pagination** is the right choice here.

**Files:**
- Modify: `src/pages/ReorderRequests.jsx`

**Step 1: Add pagination state and slice the rendered list**

```jsx
import Pagination from '@/components/Pagination'

const PAGE_SIZE = 50
const [currentPage, setCurrentPage] = useState(1)

// Reset to page 1 when filters change
useEffect(() => {
  setCurrentPage(1)
}, [searchQuery, selectedStatus, selectedPriority, selectedCategory, selectedLocation, sortDirection])

// Paginate filteredRequests
const totalPages = Math.ceil(filteredRequests.length / PAGE_SIZE)
const paginatedRequests = filteredRequests.slice(
  (currentPage - 1) * PAGE_SIZE,
  currentPage * PAGE_SIZE
)
```

**Rendering changes:**
- Replace `filteredRequests.map(...)` with `paginatedRequests.map(...)` in both mobile and desktop views
- Add `<Pagination>` after the list
- Update header count to show total: `{filteredRequests.length} request{...}`

**Step 2: Commit**

```bash
git add src/pages/ReorderRequests.jsx
git commit -m "feat: add client-side pagination to ReorderRequests"
```

---

### Task 5: Add client-side pagination to AdminPanel tabs

AdminPanel already has server-side pagination for audit logs. Add client-side pagination to: deleted items, checkout history, and admin comments tabs.

**Files:**
- Modify: `src/pages/AdminPanel.jsx`

**Step 1: Add pagination state for each tab**

```jsx
const [deletedPage, setDeletedPage] = useState(1)
const [checkoutPage, setCheckoutPage] = useState(1)
const [commentsPage, setCommentsPage] = useState(1)
const ADMIN_PAGE_SIZE = 50
```

**Step 2: Paginate filtered results in each tab**

For each tab (deleted items, checkout history, admin comments), slice the filtered array before rendering and add `<Pagination>` component after the list.

Reset page to 1 when filters change in each tab.

**Step 3: Also update existing audit log pagination to use the shared Pagination component**

Replace the inline prev/next buttons (lines ~2031-2067 and ~2350-2390) with `<Pagination>` component for consistency.

**Step 4: Commit**

```bash
git add src/pages/AdminPanel.jsx
git commit -m "feat: add pagination to AdminPanel deleted/checkout/comments tabs"
```

---

### Task 6: Update Dashboard.jsx to remove fetchAllRows

Dashboard shows summary counts and top items — it doesn't need all items. But it currently fetches all items to compute totals. Since we want accurate total counts, we have two options:
1. Use `{ count: 'exact', head: true }` for just the count
2. Keep fetching all for now since Dashboard aggregates across all items

For simplicity and accuracy (Dashboard needs to compute checkout stats), keep `fetchAllRows` on Dashboard since it needs all items for aggregation. No pagination needed on Dashboard itself.

**No changes needed for Task 6.**

---

### Task 7: Clean up and verify

**Step 1: Verify build passes**

```bash
npm run build
```

**Step 2: Test each page manually**
- Items page: verify pagination controls appear, filters work with pagination, Fuse.js search works, AI search works, page resets on filter change
- LocationExplorer: verify item pagination at locations with many items, search works
- ReorderRequests: verify pagination with filters and sorting
- AdminPanel: verify all tabs paginate correctly

**Step 3: Final commit if any fixes needed**
