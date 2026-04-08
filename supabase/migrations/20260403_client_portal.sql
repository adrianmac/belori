-- portal_token column already exists on events with gen_random_uuid() default
-- unique index events_portal_token_idx already exists

-- Allow public (unauthenticated) read of events by portal_token
-- DB function that bypasses RLS for the portal
CREATE OR REPLACE FUNCTION get_event_by_portal_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', e.id,
    'type', e.type,
    'event_date', e.event_date,
    'venue', e.venue,
    'guests', e.guests,
    'status', e.status,
    'total', e.total,
    'paid', e.paid,
    'client', jsonb_build_object('name', c.name, 'phone', c.phone, 'email', c.email),
    'boutique', jsonb_build_object('name', b.name, 'phone', b.phone, 'email', b.email, 'instagram', b.instagram),
    'milestones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pm.id, 'label', pm.label, 'amount', pm.amount,
        'due_date', pm.due_date, 'status', pm.status, 'paid_date', pm.paid_date
      ) ORDER BY pm.due_date)
      FROM payment_milestones pm WHERE pm.event_id = e.id
    ), '[]'::jsonb),
    'appointments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'type', a.type, 'date', a.date, 'time', a.time, 'status', a.status
      ) ORDER BY a.date, a.time)
      FROM appointments a WHERE a.event_id = e.id AND a.date >= CURRENT_DATE
    ), '[]'::jsonb),
    'inventory', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', inv.name, 'category', inv.category, 'status', inv.status,
        'return_date', inv.return_date, 'pickup_date', inv.pickup_date
      ))
      FROM inventory inv WHERE inv.client_id = c.id AND inv.status IN ('rented','picked_up')
    ), '[]'::jsonb)
  ) INTO result
  FROM events e
  JOIN clients c ON c.id = e.client_id
  JOIN boutiques b ON b.id = e.boutique_id
  WHERE e.portal_token = p_token;

  RETURN result;
END;
$$;

-- Grant execute to anon role
GRANT EXECUTE ON FUNCTION get_event_by_portal_token(uuid) TO anon;
