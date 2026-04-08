alter table boutiques add column if not exists calendar_feed_accessed_at timestamptz;
alter table boutiques add column if not exists calendar_feed_access_count int default 0;
