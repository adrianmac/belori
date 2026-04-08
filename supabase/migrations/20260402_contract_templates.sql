alter table boutiques add column if not exists contract_templates jsonb default '{}'::jsonb;
