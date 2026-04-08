-- Add mood_board column to events table
-- mood_board stores an array of { id, url, caption, type: 'upload'|'url', added_at }
alter table events add column if not exists mood_board jsonb default '[]'::jsonb;
