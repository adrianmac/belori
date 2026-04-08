-- Allow kiosk try-on requests (consultation type, no event)
CREATE POLICY "appointments_kiosk_tryon_insert" ON appointments
  FOR INSERT TO anon
  WITH CHECK (
    event_id IS NULL
    AND type = 'consultation'
    AND status = 'scheduled'
    AND EXISTS (SELECT 1 FROM boutiques WHERE id = boutique_id)
  );
