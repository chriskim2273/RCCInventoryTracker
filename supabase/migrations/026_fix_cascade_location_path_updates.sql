-- Fix the cascade trigger to update children level-by-level
-- The previous single-UPDATE approach failed because PostgreSQL's BEFORE trigger
-- reads parent paths from the pre-statement snapshot, causing grandchildren+ to
-- get stale paths recomputed by the BEFORE trigger.
-- This level-by-level approach ensures each depth sees its parent's committed update.

CREATE OR REPLACE FUNCTION update_child_location_paths()
RETURNS TRIGGER AS $$
DECLARE
  current_parent_ids UUID[];
  next_parent_ids UUID[];
  depth INT := 0;
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name OR OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
    -- Start with the renamed location's direct children
    current_parent_ids := ARRAY[NEW.id];

    LOOP
      depth := depth + 1;
      IF depth > 50 THEN
        RAISE EXCEPTION 'Location tree depth exceeded 50 levels - possible circular reference';
      END IF;

      -- Update one level at a time: children of the current set
      -- SET path = path is a "touch" that fires the BEFORE trigger (update_location_path)
      -- which recalculates path from the parent's CURRENT (already-committed) path.
      WITH updated AS (
        UPDATE locations
        SET path = path
        WHERE parent_id = ANY(current_parent_ids)
          AND deleted_at IS NULL
        RETURNING id
      )
      SELECT array_agg(id) INTO next_parent_ids FROM updated;

      EXIT WHEN next_parent_ids IS NULL;

      current_parent_ids := next_parent_ids;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the AFTER trigger exists (idempotent for fresh deployments)
DROP TRIGGER IF EXISTS update_child_paths_trigger ON locations;
CREATE TRIGGER update_child_paths_trigger
  AFTER UPDATE ON locations
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name OR OLD.parent_id IS DISTINCT FROM NEW.parent_id)
  EXECUTE FUNCTION update_child_location_paths();

-- Fix all existing stale paths
WITH RECURSIVE location_tree AS (
  SELECT id, name, parent_id, path,
         name AS computed_path
  FROM locations
  WHERE parent_id IS NULL AND deleted_at IS NULL

  UNION ALL

  SELECT l.id, l.name, l.parent_id, l.path,
         lt.computed_path || ' / ' || l.name AS computed_path
  FROM locations l
  JOIN location_tree lt ON l.parent_id = lt.id
  WHERE l.deleted_at IS NULL
)
UPDATE locations l
SET path = lt.computed_path
FROM location_tree lt
WHERE l.id = lt.id
  AND l.path IS DISTINCT FROM lt.computed_path;
