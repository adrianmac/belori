-- ============================================================
-- SECURITY: HIGH severity fixes — 2026-04-16
-- SEC-H1: Storage bucket RLS — private and public buckets
-- SEC-H2: API keys moved out of boutiques table into owner-only table
-- ============================================================


-- ═══════════════════════════════════════════════════════════════
-- SEC-H1: Storage RLS
--
-- Private buckets: event-files, event-photos, voice-notes,
--                  invoice-attachments, event-inspiration
-- Public buckets:  mood-board, dress-images
--
-- Path convention for private buckets: {boutique_id}/...
-- storage.foldername(name)[1] extracts the first path segment.
-- ═══════════════════════════════════════════════════════════════

-- ─── Helper: resolve the caller's boutique_id once ────────────
-- We use a subquery against boutique_members rather than
-- my_boutique_id() because storage policies run in a different
-- security context and my_boutique_id() may not be available.

-- ─── event-files (PRIVATE) ────────────────────────────────────

DROP POLICY IF EXISTS "priv_event_files_select"   ON storage.objects;
DROP POLICY IF EXISTS "priv_event_files_insert"   ON storage.objects;
DROP POLICY IF EXISTS "priv_event_files_delete"   ON storage.objects;

CREATE POLICY "priv_event_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'event-files'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "priv_event_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-files'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "priv_event_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'event-files'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- ─── event-photos (PRIVATE) ───────────────────────────────────

DROP POLICY IF EXISTS "priv_event_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "priv_event_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "priv_event_photos_delete" ON storage.objects;

CREATE POLICY "priv_event_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'event-photos'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "priv_event_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-photos'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "priv_event_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'event-photos'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- ─── voice-notes (PRIVATE) ────────────────────────────────────

DROP POLICY IF EXISTS "priv_voice_notes_select" ON storage.objects;
DROP POLICY IF EXISTS "priv_voice_notes_insert" ON storage.objects;
DROP POLICY IF EXISTS "priv_voice_notes_delete" ON storage.objects;

CREATE POLICY "priv_voice_notes_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "priv_voice_notes_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "priv_voice_notes_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- ─── invoice-attachments (PRIVATE) ───────────────────────────

DROP POLICY IF EXISTS "priv_invoice_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "priv_invoice_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "priv_invoice_attachments_delete" ON storage.objects;

CREATE POLICY "priv_invoice_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoice-attachments'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "priv_invoice_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'invoice-attachments'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "priv_invoice_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'invoice-attachments'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- ─── event-inspiration (PRIVATE) ─────────────────────────────

DROP POLICY IF EXISTS "priv_event_inspiration_select" ON storage.objects;
DROP POLICY IF EXISTS "priv_event_inspiration_insert" ON storage.objects;
DROP POLICY IF EXISTS "priv_event_inspiration_delete" ON storage.objects;

CREATE POLICY "priv_event_inspiration_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'event-inspiration'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "priv_event_inspiration_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-inspiration'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "priv_event_inspiration_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'event-inspiration'
    AND (storage.foldername(name))[1] = (
      SELECT boutique_id::text
      FROM boutique_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- ─── mood-board (PUBLIC read, member write/delete) ────────────

DROP POLICY IF EXISTS "pub_mood_board_select"  ON storage.objects;
DROP POLICY IF EXISTS "pub_mood_board_insert"  ON storage.objects;
DROP POLICY IF EXISTS "pub_mood_board_update"  ON storage.objects;
DROP POLICY IF EXISTS "pub_mood_board_delete"  ON storage.objects;

-- Public read is intentional — mood board images are shared with clients
CREATE POLICY "pub_mood_board_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'mood-board');

-- Only authenticated boutique members may upload or remove
CREATE POLICY "pub_mood_board_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mood-board'
    AND EXISTS (
      SELECT 1 FROM boutique_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pub_mood_board_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mood-board'
    AND EXISTS (
      SELECT 1 FROM boutique_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pub_mood_board_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'mood-board'
    AND EXISTS (
      SELECT 1 FROM boutique_members WHERE user_id = auth.uid()
    )
  );

-- ─── dress-images (PUBLIC read, member write/delete) ──────────

DROP POLICY IF EXISTS "pub_dress_images_select" ON storage.objects;
DROP POLICY IF EXISTS "pub_dress_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "pub_dress_images_update" ON storage.objects;
DROP POLICY IF EXISTS "pub_dress_images_delete" ON storage.objects;

-- Public read is intentional — inventory catalog photos are displayed to visitors
CREATE POLICY "pub_dress_images_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'dress-images');

CREATE POLICY "pub_dress_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dress-images'
    AND EXISTS (
      SELECT 1 FROM boutique_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pub_dress_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dress-images'
    AND EXISTS (
      SELECT 1 FROM boutique_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pub_dress_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'dress-images'
    AND EXISTS (
      SELECT 1 FROM boutique_members WHERE user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- SEC-H2: Move third-party API keys out of boutiques table
--
-- boutiques is readable by all boutique_members via RLS.
-- OAuth tokens and API keys must only be readable by owners.
-- Solution: dedicated boutique_integrations table, owner-only RLS.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Create boutique_integrations ─────────────────────────

CREATE TABLE IF NOT EXISTS boutique_integrations (
  boutique_id           uuid        PRIMARY KEY REFERENCES boutiques(id) ON DELETE CASCADE,
  qbo_access_token      text,
  qbo_refresh_token     text,
  qbo_realm_id          text,
  qbo_connected_at      timestamptz,
  qbo_synced_at         timestamptz,
  mailchimp_api_key     text,
  mailchimp_list_id     text,
  mailchimp_connected_at timestamptz,
  klaviyo_api_key       text,
  klaviyo_list_id       text,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE boutique_integrations ENABLE ROW LEVEL SECURITY;

-- ─── 2. Owner-only SELECT ─────────────────────────────────────

DROP POLICY IF EXISTS "owner_only_integrations_select" ON boutique_integrations;
CREATE POLICY "owner_only_integrations_select" ON boutique_integrations
  FOR SELECT USING (
    boutique_id = my_boutique_id()
    AND EXISTS (
      SELECT 1 FROM boutique_members
      WHERE user_id = auth.uid()
        AND boutique_id = boutique_integrations.boutique_id
        AND role = 'owner'
    )
  );

-- ─── 3. Owner-only INSERT ─────────────────────────────────────

DROP POLICY IF EXISTS "owner_only_integrations_insert" ON boutique_integrations;
CREATE POLICY "owner_only_integrations_insert" ON boutique_integrations
  FOR INSERT TO authenticated
  WITH CHECK (
    boutique_id = my_boutique_id()
    AND EXISTS (
      SELECT 1 FROM boutique_members
      WHERE user_id = auth.uid()
        AND boutique_id = boutique_integrations.boutique_id
        AND role = 'owner'
    )
  );

-- ─── 4. Owner-only UPDATE ─────────────────────────────────────

DROP POLICY IF EXISTS "owner_only_integrations_update" ON boutique_integrations;
CREATE POLICY "owner_only_integrations_update" ON boutique_integrations
  FOR UPDATE TO authenticated
  USING (
    boutique_id = my_boutique_id()
    AND EXISTS (
      SELECT 1 FROM boutique_members
      WHERE user_id = auth.uid()
        AND boutique_id = boutique_integrations.boutique_id
        AND role = 'owner'
    )
  )
  WITH CHECK (
    boutique_id = my_boutique_id()
    AND EXISTS (
      SELECT 1 FROM boutique_members
      WHERE user_id = auth.uid()
        AND boutique_id = boutique_integrations.boutique_id
        AND role = 'owner'
    )
  );

-- ─── 5. Owner-only DELETE ─────────────────────────────────────

DROP POLICY IF EXISTS "owner_only_integrations_delete" ON boutique_integrations;
CREATE POLICY "owner_only_integrations_delete" ON boutique_integrations
  FOR DELETE TO authenticated
  USING (
    boutique_id = my_boutique_id()
    AND EXISTS (
      SELECT 1 FROM boutique_members
      WHERE user_id = auth.uid()
        AND boutique_id = boutique_integrations.boutique_id
        AND role = 'owner'
    )
  );

-- ─── 6. Migrate existing data ────────────────────────────────
-- Copy rows that have at least one credential set.
-- ON CONFLICT handles the case where the table already existed
-- (e.g. migration was partially applied).

INSERT INTO boutique_integrations (
  boutique_id,
  qbo_access_token,
  qbo_refresh_token,
  qbo_realm_id,
  qbo_connected_at,
  qbo_synced_at,
  mailchimp_api_key,
  mailchimp_list_id,
  mailchimp_connected_at,
  klaviyo_api_key,
  klaviyo_list_id,
  updated_at
)
SELECT
  id,
  qbo_access_token,
  qbo_refresh_token,
  qbo_realm_id,
  qbo_connected_at,
  qbo_synced_at,
  mailchimp_api_key,
  mailchimp_list_id,
  mailchimp_connected_at,
  klaviyo_api_key,
  klaviyo_list_id,
  now()
FROM boutiques
WHERE
  qbo_access_token   IS NOT NULL
  OR qbo_refresh_token IS NOT NULL
  OR mailchimp_api_key IS NOT NULL
  OR klaviyo_api_key   IS NOT NULL
ON CONFLICT (boutique_id) DO UPDATE SET
  qbo_access_token      = EXCLUDED.qbo_access_token,
  qbo_refresh_token     = EXCLUDED.qbo_refresh_token,
  qbo_realm_id          = EXCLUDED.qbo_realm_id,
  qbo_connected_at      = EXCLUDED.qbo_connected_at,
  qbo_synced_at         = EXCLUDED.qbo_synced_at,
  mailchimp_api_key     = EXCLUDED.mailchimp_api_key,
  mailchimp_list_id     = EXCLUDED.mailchimp_list_id,
  mailchimp_connected_at = EXCLUDED.mailchimp_connected_at,
  klaviyo_api_key       = EXCLUDED.klaviyo_api_key,
  klaviyo_list_id       = EXCLUDED.klaviyo_list_id,
  updated_at            = now();

-- ─── 7. Drop plaintext credential columns from boutiques ─────
-- These columns are now in boutique_integrations (owner-only).
-- Non-sensitive metadata columns (realm_id, list_id, *_at) are
-- also moved since they belong with their associated secrets.

ALTER TABLE boutiques
  DROP COLUMN IF EXISTS qbo_access_token,
  DROP COLUMN IF EXISTS qbo_refresh_token,
  DROP COLUMN IF EXISTS qbo_realm_id,
  DROP COLUMN IF EXISTS qbo_connected_at,
  DROP COLUMN IF EXISTS qbo_synced_at,
  DROP COLUMN IF EXISTS mailchimp_api_key,
  DROP COLUMN IF EXISTS mailchimp_list_id,
  DROP COLUMN IF EXISTS mailchimp_connected_at,
  DROP COLUMN IF EXISTS klaviyo_api_key,
  DROP COLUMN IF EXISTS klaviyo_list_id;
