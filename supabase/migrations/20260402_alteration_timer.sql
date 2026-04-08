alter table alteration_jobs add column if not exists time_entries jsonb default '[]'::jsonb;
alter table alteration_jobs add column if not exists total_minutes int default 0;
