-- GDPR / privacy data deletion requests
create table if not exists data_deletion_requests (
  id            uuid        primary key default gen_random_uuid(),
  email         text        not null,
  name          text,
  reason        text,
  status        text        not null default 'pending'
                            check (status in ('pending','in_progress','completed','rejected')),
  submitted_at  timestamptz not null default now(),
  completed_at  timestamptz,
  notes         text
);

-- Public submissions — no RLS needed.
-- Rate-limiting is handled at the application layer (one request per email address per day).
-- Boutique admins query this table client-side filtered by client emails.

-- Index for email lookups (admin view)
create index if not exists data_deletion_requests_email_idx on data_deletion_requests(email);
-- Index for status filtering
create index if not exists data_deletion_requests_status_idx on data_deletion_requests(status);
