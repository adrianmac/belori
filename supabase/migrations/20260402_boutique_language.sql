alter table boutiques add column if not exists language text default 'en' check (language in ('en','es'));
