-- Store wedding date on completed wedding events for anniversary tracking
-- Already exists as event_date on events table — we just need to query it
-- Add anniversary_sms_sent_at to events to avoid duplicate sends
alter table events add column if not exists anniversary_sms_sent_at timestamptz;
