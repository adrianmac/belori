-- Integrations: QuickBooks Online, Mailchimp, Klaviyo
alter table boutiques add column if not exists qbo_access_token text;
alter table boutiques add column if not exists qbo_refresh_token text;
alter table boutiques add column if not exists qbo_realm_id text;
alter table boutiques add column if not exists qbo_connected_at timestamptz;
alter table boutiques add column if not exists qbo_synced_at timestamptz;
alter table boutiques add column if not exists mailchimp_api_key text;
alter table boutiques add column if not exists mailchimp_list_id text;
alter table boutiques add column if not exists mailchimp_connected_at timestamptz;
alter table boutiques add column if not exists klaviyo_api_key text;
alter table boutiques add column if not exists klaviyo_list_id text;
