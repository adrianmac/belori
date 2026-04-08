-- Add redemption records to loyalty_transactions
alter table loyalty_transactions add column if not exists type text default 'earn' check (type in ('earn','redeem','adjust','expire'));
alter table loyalty_transactions add column if not exists note text;
alter table loyalty_transactions add column if not exists redeemed_by text;
alter table loyalty_transactions add column if not exists event_id uuid references events(id) on delete set null;

-- Loyalty settings on boutique
alter table boutiques add column if not exists loyalty_settings jsonb default '{"points_per_dollar": 1, "points_to_dollar": 100, "min_redeem": 500}'::jsonb;
