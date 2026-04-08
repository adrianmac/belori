-- Add public profile slug to boutiques
alter table boutiques add column if not exists slug text;
create unique index if not exists boutiques_slug_idx on boutiques(slug) where slug is not null;
