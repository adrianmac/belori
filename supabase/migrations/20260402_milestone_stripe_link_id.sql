-- Add stripe_payment_link_id column to payment_milestones
-- This stores the Stripe payment link ID (pl_xxx) for direct dashboard linking
alter table payment_milestones add column if not exists stripe_payment_link_id text;
