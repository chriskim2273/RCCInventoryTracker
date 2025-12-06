-- Add order_link column to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS order_link TEXT;

-- Create reorder request status enum
DO $$ BEGIN
  CREATE TYPE reorder_request_status AS ENUM (
    'new_request',
    'approved_pending',
    'purchased',
    'arrived',
    'documented',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create reorder request priority enum
DO $$ BEGIN
  CREATE TYPE reorder_request_priority AS ENUM ('high', 'standard');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create reorder_requests table
CREATE TABLE IF NOT EXISTS reorder_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  date_requested TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  priority reorder_request_priority NOT NULL DEFAULT 'standard',

  -- Item details (for new items not in inventory or to capture at time of request)
  item_name TEXT NOT NULL,
  item_brand TEXT,
  item_model TEXT,
  item_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Order details
  quantity_to_order INTEGER NOT NULL CHECK (quantity_to_order > 0),
  units_per_pack INTEGER CHECK (units_per_pack IS NULL OR units_per_pack > 0),
  price_per_pack DECIMAL(10, 2) NOT NULL CHECK (price_per_pack >= 0),
  order_link TEXT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,

  -- User tracking
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_by_name TEXT,

  -- Status tracking
  status reorder_request_status NOT NULL DEFAULT 'new_request',
  status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Purchase tracking
  purchased_by UUID REFERENCES users(id),
  purchased_by_name TEXT,
  purchased_on TIMESTAMP WITH TIME ZONE,

  -- Arrival and documentation tracking
  arrived_on TIMESTAMP WITH TIME ZONE,
  documented_on TIMESTAMP WITH TIME ZONE,

  -- Additional info
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_reorder_requests_item_id ON reorder_requests(item_id);
CREATE INDEX IF NOT EXISTS idx_reorder_requests_status ON reorder_requests(status);
CREATE INDEX IF NOT EXISTS idx_reorder_requests_status_updated_at ON reorder_requests(status_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reorder_requests_requested_by ON reorder_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_reorder_requests_purchased_by ON reorder_requests(purchased_by);
CREATE INDEX IF NOT EXISTS idx_reorder_requests_location_id ON reorder_requests(location_id);
CREATE INDEX IF NOT EXISTS idx_reorder_requests_category_id ON reorder_requests(item_category_id);

-- Enable RLS
ALTER TABLE reorder_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reorder_requests

-- Admins and coordinators can view all reorder requests
CREATE POLICY "Admins and coordinators can view reorder requests"
  ON reorder_requests FOR SELECT
  USING (get_user_role() IN ('admin', 'coordinator'));

-- Admins and coordinators can create reorder requests
CREATE POLICY "Admins and coordinators can create reorder requests"
  ON reorder_requests FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'coordinator'));

-- Admins and coordinators can update reorder requests
CREATE POLICY "Admins and coordinators can update reorder requests"
  ON reorder_requests FOR UPDATE
  USING (get_user_role() IN ('admin', 'coordinator'));

-- Admins and coordinators can delete reorder requests
CREATE POLICY "Admins and coordinators can delete reorder requests"
  ON reorder_requests FOR DELETE
  USING (get_user_role() IN ('admin', 'coordinator'));

-- Trigger to update updated_at timestamp
CREATE TRIGGER set_reorder_requests_updated_at
  BEFORE UPDATE ON reorder_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to update status_updated_at and auto-set date fields when status changes
CREATE OR REPLACE FUNCTION update_reorder_request_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_updated_at = NOW();

    -- Auto-set timestamps based on status
    IF NEW.status = 'purchased' AND OLD.status != 'purchased' THEN
      NEW.purchased_on = COALESCE(NEW.purchased_on, NOW());
    ELSIF NEW.status = 'arrived' AND OLD.status != 'arrived' THEN
      NEW.arrived_on = COALESCE(NEW.arrived_on, NOW());
    ELSIF NEW.status = 'documented' AND OLD.status != 'documented' THEN
      NEW.documented_on = COALESCE(NEW.documented_on, NOW());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reorder_request_status_timestamp
  BEFORE UPDATE ON reorder_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_reorder_request_status_timestamp();
