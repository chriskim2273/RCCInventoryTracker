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

### 3. **Audit Log Search Filter (BUG)**
**Problem:** The search filter only searched `log.item?.name`, which meant:
- Hard-deleted item logs (where `log.item` is null) would never appear in search results
- Users couldn't find logs for deleted items

**Solution:** Enhanced search filter (lines 86-116)
- Search in `log.item.name` if item exists
- Also search in `log.changes.old.name` and `log.changes.new.name` (which contains data for hard-deleted items)
- Also search in serial numbers from the changes field
- Now hard-deleted item logs are searchable

---

### 4. **Checkout Logs Preservation (IMPORTANT)**
**Problem:** The `checkout_logs` table also had `ON DELETE CASCADE`, meaning when an item is hard deleted, all checkout history would be permanently lost.

**Solution:** Migration `016_preserve_checkout_logs_on_hard_delete.sql`
- Changed FK constraint from `ON DELETE CASCADE` to `ON DELETE SET NULL`
- Made `item_id` nullable
- When an item is hard deleted, checkout logs remain with `item_id = NULL`
- UI already handles null items properly (shows "Unknown Item")

---

## Required Migrations

Run these in order in your Supabase SQL Editor:

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

---

## Verification

After applying both migrations:

1. **Test Hard Delete:**
   - Should work without FK constraint errors
   - Item should be completely removed from database

2. **Test Item Audit Trail:**
   - Should display without PostgREST errors
   - Should show "Unknown Item" for hard-deleted items
   - Search should work for both existing and deleted items

3. **Test Checkout History:**
   - Should display checkout logs even after item is hard deleted
   - Should show "Unknown Item" where the item was deleted

---

## Files Modified

1. `src/pages/AdminPanel.jsx` - Fixed audit log query and search filter
2. `supabase/migrations/015_remove_item_logs_fk_constraint.sql` - Remove item_logs FK
3. `supabase/migrations/016_preserve_checkout_logs_on_hard_delete.sql` - Preserve checkout logs

---

## Technical Details

**Why remove the FK constraint for item_logs?**
PostgreSQL foreign key constraints with RLS enabled check the referenced table through RLS policies. During a DELETE operation, the trigger fires BEFORE the delete, tries to INSERT into `item_logs` with the item_id, but the FK constraint check fails because:
1. The constraint validator runs in the context of the current user
2. RLS policies may filter the item being deleted
3. The validator can't "see" the item, causing the FK constraint violation

Removing the FK constraint allows the trigger to work while application logic maintains referential integrity.

**Why use SET NULL for checkout_logs instead of removing FK?**
Unlike item_logs, checkout_logs doesn't have a trigger that inserts during deletion. The `ON DELETE SET NULL` happens after the deletion completes, so there's no RLS context issue. Keeping the FK constraint maintains database integrity while preserving the logs.
