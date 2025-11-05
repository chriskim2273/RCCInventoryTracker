# Hard Delete Feature Implementation

## Overview
Added the ability to permanently delete items, locations, and categories from the "Deleted Items" panel in the Admin Panel. This feature includes full audit trail support and a comprehensive confirmation modal.

## Changes Made

### 1. Hard Delete Confirmation Modal (HardDeleteConfirmationModal.jsx)
- Created a generic confirmation modal that handles items, locations, and categories with:
  - Critical warning banner in red with clear messaging
  - Dynamic display based on type (item/location/category)
  - Shows relevant details: name, serial number (items), path (locations)
  - Explanatory note about difference between soft delete and hard delete
  - Three confirmation checkboxes that must all be checked
  - Text input requiring "PERMANENTLY DELETE" to be typed exactly
  - Email verification requiring user's email to be entered
  - Only enables delete button when all confirmations are complete
  - Visual styling with red/destructive colors throughout

### 2. Backend Functions (AdminPanel.jsx)
- Added `prepareHardDeleteItem()` function (lines 703-722):
  - Retrieves item details from database
  - Populates modal data with type, name, and serial number
  - Opens the HardDeleteConfirmationModal
- Added `prepareHardDeleteLocation()` function (lines 724-743):
  - Retrieves location details from database
  - Populates modal data with type, name, and path
  - Opens the HardDeleteConfirmationModal
- Added `prepareHardDeleteCategory()` function (lines 745-762):
  - Retrieves category details from database
  - Populates modal data with type and name
  - Opens the HardDeleteConfirmationModal
- Added `confirmHardDelete()` function (lines 764-827):
  - Unified function that handles all three types (item, location, category)
  - Performs the actual hard delete using `supabase.delete()`
  - Logs the action to `audit_logs` table with appropriate action:
    - `'hard_delete_item'` for items (also logs to `item_logs` via trigger)
    - `'hard_delete_location'` for locations
    - `'hard_delete_category'` for categories
  - Refreshes data after successful deletion

### 3. UI Changes (AdminPanel.jsx)
- **Deleted Items Table** (lines 1741-1747):
  - Updated to show both "Restore" and "Hard Delete" buttons
  - Hard Delete button uses red/destructive styling to indicate danger
  - Both buttons are displayed side-by-side in the Actions column
  - Hard Delete button opens the HardDeleteConfirmationModal
- **Deleted Locations Table** (lines 1877-1894):
  - Added "Hard Delete" button alongside "Restore" button
  - Same styling and behavior as items
- **Deleted Categories Table** (lines 1933-1950):
  - Added "Hard Delete" button alongside "Restore" button
  - Same styling and behavior as items

### 4. Audit Trail Display (AdminPanel.jsx:1351-1366)
- Added support for displaying `'delete'` action logs in the Item Audit Trail tab
- Shows deleted item's values in a red-highlighted box with warning styling
- Displays message: "Item permanently deleted with the following values:"

### 5. Admin Audit Logs (AdminPanel.jsx)
- **Action Filter Dropdown** (lines 1498-1503):
  - Added `'hard_delete_item'` option
  - Added `'hard_delete_location'` option
  - Added `'hard_delete_category'` option
- **Display Titles** (lines 1570-1583):
  - Added "Item Permanently Deleted" for `hard_delete_item` action
  - Added "Location Permanently Deleted" for `hard_delete_location` action
  - Added "Category Permanently Deleted" for `hard_delete_category` action

### 6. Database Migration (014_preserve_item_logs_on_hard_delete.sql)
**IMPORTANT: This migration must be applied before using the hard delete feature!**

The migration:
- Drops the existing `item_logs.item_id` foreign key with CASCADE behavior
- Makes `item_id` nullable to allow orphaned logs
- Adds new foreign key with `ON DELETE SET NULL` instead of `CASCADE`
- This preserves audit logs even after items are permanently deleted

## How to Apply the Migration

### Option 1: Using Supabase CLI (Recommended)
```bash
# First, link your project if not already linked
npx supabase link --project-ref your-project-ref

# Apply the migration
npx supabase db push
```

### Option 2: Manual Application via Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/014_preserve_item_logs_on_hard_delete.sql`
4. Paste and execute the SQL

### Option 3: Using Database URL
```bash
npx supabase db push --db-url "your-database-connection-string"
```

## Testing the Feature

### Prerequisites
1. Apply the database migration (see above)
2. Ensure you're logged in as an admin user
3. Have at least one soft-deleted item in the system

### Test Steps

1. **Create Test Data and Soft Delete:**
   - **For Items:**
     - Go to Items page
     - Create a new test item (e.g., "Test Item for Hard Delete")
     - Delete the item (this performs a soft delete)
   - **For Locations:**
     - Go to Locations page
     - Create a new test location (e.g., "Test Location for Hard Delete")
     - Delete the location (this performs a soft delete)
   - **For Categories:**
     - Go to Admin Panel > Categories tab
     - Create a new test category (e.g., "Test Category for Hard Delete")
     - Delete the category (this performs a soft delete)

2. **Navigate to Deleted Items:**
   - Go to Admin Panel
   - Click on "Deleted Items" tab
   - Verify you can see all soft-deleted items, locations, and categories

3. **Test Hard Delete Modal (repeat for all three types):**
   - Click the "Hard Delete" button next to a test item/location/category
   - Verify the HardDeleteConfirmationModal opens with:
     - Red critical warning banner
     - Correct type displayed (item/location/category)
     - Name and relevant details displayed:
       - Items: name and serial number
       - Locations: name and path
       - Categories: name only
     - Three confirmation checkboxes
     - Text input field requiring "PERMANENTLY DELETE"
     - Email input field
   - Try clicking the "Permanently Delete" button without completing all steps (should be disabled)
   - Check all three checkboxes
   - Type "PERMANENTLY DELETE" in the text field (case-sensitive)
   - Enter your admin email address
   - Verify the "Permanently Delete" button becomes enabled
   - Click "Permanently Delete"
   - Verify the item/location/category is removed from the Deleted Items list

4. **Verify Item Audit Trail:**
   - Go to Admin Panel > "Item Audit Trail" tab
   - Search for your test item or filter by "Delete" action
   - Verify you see an entry with:
     - Action badge showing "delete" (red background)
     - Item name shows as "Unknown Item" (since it's hard deleted)
     - Expanded details show "Item permanently deleted with the following values:"
     - All the item's final values are displayed in a red-highlighted box

5. **Verify Admin Audit Logs:**
   - Go to Admin Panel > "Admin Actions" tab
   - Test filtering by each hard delete action:
     - **"Hard Delete Item":** Title shows "Item Permanently Deleted", details include name and serial number
     - **"Hard Delete Location":** Title shows "Location Permanently Deleted", details include name and path
     - **"Hard Delete Category":** Title shows "Category Permanently Deleted", details include name

6. **Verify Database State:**
   - Items/locations/categories should be completely removed from their respective tables
   - For items: The `item_logs` entry should still exist with `item_id` set to NULL
   - For locations/categories: No separate audit logs (they only exist in `audit_logs`)
   - The `audit_logs` entry should exist with the appropriate action:
     - `'hard_delete_item'`, `'hard_delete_location'`, or `'hard_delete_category'`

## Security Notes

- Hard delete is only available to admin users (via the Admin Panel)
- The feature includes a comprehensive confirmation modal with multiple verification steps
- All hard deletes are logged in `audit_logs` table
- Items also logged in `item_logs` (locations/categories don't have separate log tables)
- Audit logs are preserved even after hard deletion (via migration for items)

## Files Modified

1. `src/components/HardDeleteConfirmationModal.jsx` - New confirmation modal component (created)
2. `src/pages/AdminPanel.jsx` - Added hard delete functions, modal integration, and UI updates
3. `supabase/migrations/014_preserve_item_logs_on_hard_delete.sql` - Database migration (created)

## Notes and Limitations

- Once hard deleted, items/locations/categories cannot be restored (by design - this is permanent!)
- The item audit logs will show "Unknown Item" for hard-deleted items (this is expected)
- Locations and categories don't have separate audit log tables like items do
  - Their hard deletes are only logged in the admin `audit_logs` table
  - No additional migration needed for locations/categories
- Hard deleting a location will also hard delete all items in that location (cascading delete)
- Hard deleting a category will set the category_id to NULL for all items using that category
