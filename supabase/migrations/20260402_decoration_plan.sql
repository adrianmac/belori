-- Decoration plan jsonb column on events
ALTER TABLE events ADD COLUMN IF NOT EXISTS decoration_plan jsonb DEFAULT '{}'::jsonb;

-- Extra columns on event_inventory for decoration planner
ALTER TABLE event_inventory ADD COLUMN IF NOT EXISTS category_tag text; -- e.g. 'florals','backdrop','tables','lighting'
ALTER TABLE event_inventory ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
