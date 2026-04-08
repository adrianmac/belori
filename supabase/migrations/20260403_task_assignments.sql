-- Add assignment and tracking columns to the tasks table (event tasks)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_id uuid REFERENCES boutique_members(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_name text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS done_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS done_by_name text;
