-- Add photo_url column to inventory for camera-captured dress photos
alter table inventory add column if not exists photo_url text;
