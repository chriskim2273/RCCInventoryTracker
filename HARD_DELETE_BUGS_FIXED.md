# Hard Delete Bugs Fixed

## Issues Found and Fixed

### 1. **Item Logs FK Constraint (CRITICAL)**
**Problem:** The `item_logs` table had a foreign key with `ON DELETE CASCADE`. When the DELETE trigger tried to INSERT into `item_logs` during hard deletion, the FK constraint check failed due to RLS policies checking the referenced table.

**Solution:** Migration `015_remove_item_logs_fk_constraint.sql`
- Removed the FK constraint entirely
- Made `item_id` nullable
- Created a performance index
- This allows the trigger to work without FK constraint validation issues

---

### 2. **Item Audit Trail Query (CRITICAL)**
**Problem:** After removing the FK constraint, PostgREST could no longer perform automatic joins using `item:items(name)` syntax, causing the audit trail to fail with error:
```
Could not find a relationship between 'item_logs' and 'items' in the schema cache
```

**Solution:** Modified `AdminPanel.jsx` (lines 290-313)
- Fetch `item_logs` and `items` separately in parallel
- Manually join them in JavaScript using a Map
- Preserves same functionality - shows item names for existing items, null for hard-deleted items

---

### 3. **User FK Constraints (CRITICAL)**
**Problem:** After applying migration 017 (preserve logs on user delete), all tables that referenced users had their FK constraints removed. This caused PostgREST join errors:
```
Could not find a relationship between 'item_logs' and 'users'
Could not find a relationship between 'checkout_logs' and 'users'
Could not find a relationship between 'audit_logs' and 'users'
```

**Solution:** Modified `AdminPanel.jsx` to manually join users data
- **Item Audit Trail** (lines 301-326): Fetch item_logs, items, and users separately, then join manually
- **Admin Audit Trail** (lines 328-347): Fetch audit_logs and users separately, then join manually
- **Checkout History** (lines 381-407): Fetch checkout_logs, items, and users separately, then join manually
- All queries now work without FK constraints while preserving audit history

---

### 4. **Audit Log Search Filter (BUG)**
**Problem:** The search filter only searched `log.item?.name`, which meant:
- Hard-deleted item logs (where `log.item` is null) would never appear in search results
- Users couldn't find logs for deleted items

**Solution:** Enhanced search filter (lines 86-116)
- Search in `log.item.name` if item exists
- Also search in `log.changes.old.name` and `log.changes.new.name` (which contains data for hard-deleted items)
- Also search in serial numbers from the changes field
- Now hard-deleted item logs are searchable

---

### 5. **Checkout Logs Preservation (IMPORTANT)**
**Problem:** The `checkout_logs` table also had `ON DELETE CASCADE`, meaning when an item is hard deleted, all checkout history would be permanently lost.

**Solution:** Migration `016_preserve_checkout_logs_on_hard_delete.sql`
- Changed FK constraint from `ON DELETE CASCADE` to `ON DELETE SET NULL`
- Made `item_id` nullable
- When an item is hard deleted, checkout logs remain with `item_id = NULL`
- UI already handles null items properly (shows "Unknown Item")

---

## Required Migrations

**IMPORTANT:** Run these migrations in order in your Supabase SQL Editor:

### Migration 015: Item Logs FK Removal
```sql
-- Remove the foreign key constraint entirely for item_logs
ALTER TABLE item_logs DROP CONSTRAINT IF EXISTS item_logs_item_id_fkey;

-- Ensure item_id is nullable
ALTER TABLE item_logs ALTER COLUMN item_id DROP NOT NULL;

-- Add a comment explaining why there's no FK constraint
COMMENT ON COLUMN item_logs.item_id IS 'References items(id) but without FK constraint to preserve audit logs after hard deletion. NULL indicates item was permanently deleted.';

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_item_logs_item_id ON item_logs(item_id) WHERE item_id IS NOT NULL;
```

### Migration 016: Checkout Logs Preservation
```sql
-- Preserve checkout_logs after hard deletion of items
ALTER TABLE checkout_logs DROP CONSTRAINT IF EXISTS checkout_logs_item_id_fkey;

-- Make item_id nullable
ALTER TABLE checkout_logs ALTER COLUMN item_id DROP NOT NULL;

-- Add new foreign key constraint with SET NULL instead of CASCADE
ALTER TABLE checkout_logs
ADD CONSTRAINT checkout_logs_item_id_fkey
FOREIGN KEY (item_id)
REFERENCES items(id)
ON DELETE SET NULL;

-- Add a comment to document this behavior
COMMENT ON COLUMN checkout_logs.item_id IS 'References items table. NULL value indicates item was hard deleted but checkout history is preserved.';
```

### Migration 017: User Deletion Preservation
This migration is quite long - see `supabase/migrations/017_preserve_logs_on_user_delete.sql`

It removes FK constraints from:
- `item_logs.user_id`
- `audit_logs.user_id`
- `checkout_logs.performed_by`
- `checkout_logs.checked_out_to_user_id`
- `items.created_by`
- `items.deleted_by`
- `locations.deleted_by`
- `categories.deleted_by`

This ensures all audit trails are preserved even after user deletion.

---

## Complete Verification Checklist

After applying all migrations, verify the following pages and features:

### Admin Panel Pages
- ✅ **Users Tab**: Should display all users
- ✅ **Items Tab**: Should display items with creator info (or "Unknown User" for deleted creators)
- ✅ **Locations Tab**: Should display all locations
- ✅ **Categories Tab**: Should display all categories
- ✅ **Item Audit Trail Tab**: Should display all item logs with user and item info
- ✅ **Admin Audit Trail Tab**: Should display admin actions with user info
- ✅ **Deleted Items Tab**: Should display soft-deleted items/locations/categories with deleter info
- ✅ **Checkout History Tab**: Should display checkout logs with item and user info

### Item Detail Page
- ✅ **Item Information**: Should display creator and current checkout user
- ✅ **Audit History**: Should display item change logs with user info
- ✅ **Checkout History**: Should display checkout/checkin history with user info

### Other Pages (No Changes Needed)
- ✅ **Dashboard**: No user FK joins - works as-is
- ✅ **Items List**: No user FK joins - works as-is
- ✅ **Location Explorer**: No user FK joins - works as-is

### Hard Delete Functionality

1. **Test Hard Delete:**
   - Should work without FK constraint errors
   - Item should be completely removed from database

2. **Test Item Audit Trail:**
   - Should display without PostgREST errors
   - Should show "Unknown Item" for hard-deleted items
   - Should show user info or handle null users gracefully
   - Search should work for both existing and deleted items

3. **Test Admin Audit Trail:**
   - Should display without PostgREST errors
   - Should show user info or handle null users gracefully

4. **Test Checkout History:**
   - Should display without PostgREST errors
   - Should display checkout logs even after item is hard deleted
   - Should show "Unknown Item" where the item was deleted
   - Should handle deleted users gracefully

---

## Files Modified

### Frontend (Complete Query Refactoring)
1. **src/pages/AdminPanel.jsx** - Fixed 6 query locations:
   - Items tab: Manual user join for created_by
   - Audit trail tab: Manual joins for items and users
   - Admin audit trail tab: Manual user joins
   - Deleted items tab: Manual user joins for all three tables (items, locations, categories)
   - Checkout history tab: Manual joins for items and users

2. **src/pages/ItemDetail.jsx** - Fixed 3 query locations:
   - Item query: Manual user joins for created_by and checked_out_by
   - Item logs query: Manual user joins
   - Checkout logs query: Manual user joins for performed_by and checked_out_to_user_id

### Database Migrations
3. `supabase/migrations/015_remove_item_logs_fk_constraint.sql` - Remove item_logs.item_id FK
4. `supabase/migrations/016_preserve_checkout_logs_on_hard_delete.sql` - Preserve checkout logs on item delete
5. `supabase/migrations/017_preserve_logs_on_user_delete.sql` - Preserve all logs on user delete (9 FK constraints removed)

---

## Technical Details

### Why Remove FK Constraints?

**For item_logs (migration 015):**
PostgreSQL foreign key constraints with RLS enabled check the referenced table through RLS policies. During a DELETE operation, the trigger fires BEFORE the delete, tries to INSERT into `item_logs` with the item_id, but the FK constraint check fails because:
1. The constraint validator runs in the context of the current user
2. RLS policies may filter the item being deleted
3. The validator can't "see" the item, causing the FK constraint violation

Removing the FK constraint allows the trigger to work while application logic maintains referential integrity.

**For checkout_logs.item_id (migration 016):**
Uses `ON DELETE SET NULL` instead of removing the FK entirely, since there's no trigger conflict. This maintains some database integrity while preserving checkout history.

**For user-related FKs (migration 017):**
All user foreign keys were removed to allow users to be deleted without cascading deletes. The application handles null user references by displaying "Unknown User" in the UI.

### Application-Level Integrity

With FK constraints removed, the application maintains referential integrity through:
1. **Manual joins in JavaScript**: Fetch related data separately and join using Maps for O(1) lookup
2. **Null handling**: All UI components use `getUserDisplayName()` which handles null users gracefully
3. **Validation**: Application logic prevents invalid references during data creation
4. **Performance**: Manual joins are fast due to Map-based lookups and parallel Promise.all() fetches

### Query Pattern

All affected queries now follow this pattern:
```javascript
// Fetch data in parallel
const [dataResult, usersResult] = await Promise.all([
  supabase.from('table').select('*'),
  supabase.from('users').select('id, email, first_name, last_name')
])

// Join manually using Map for O(1) lookup
const usersMap = new Map(usersResult.data.map(u => [u.id, u]))
const dataWithUsers = dataResult.data.map(row => ({
  ...row,
  user: row.user_id ? usersMap.get(row.user_id) : null
}))
```
