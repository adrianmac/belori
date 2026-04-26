--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: accept_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_invite(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_invite  boutique_invites%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'You must be signed in to accept this invite');
  END IF;

  SELECT * INTO v_invite FROM boutique_invites WHERE token = p_token FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid invite link');
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'This invite has already been used');
  END IF;
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'This invite has expired');
  END IF;

  INSERT INTO boutique_members (boutique_id, user_id, role, name)
  VALUES (
    v_invite.boutique_id, v_user_id, v_invite.role,
    split_part(v_invite.email, '@', 1)
  )
  ON CONFLICT (boutique_id, user_id) DO NOTHING;

  UPDATE boutique_invites SET accepted_at = now() WHERE token = p_token;

  RETURN jsonb_build_object('boutique_id', v_invite.boutique_id, 'role', v_invite.role);
END;
$$;


--
-- Name: adjust_loyalty_points(uuid, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adjust_loyalty_points(p_client_id uuid, p_delta integer, p_type text DEFAULT 'adjust'::text, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_boutique_id uuid;
  v_new_total   integer;
BEGIN
  v_boutique_id := my_boutique_id();

  IF v_boutique_id IS NULL THEN
    RAISE EXCEPTION 'No boutique associated with the current session';
  END IF;

  UPDATE clients
  SET    loyalty_points = GREATEST(0, loyalty_points + p_delta)
  WHERE  id            = p_client_id
    AND  boutique_id   = v_boutique_id
  RETURNING loyalty_points INTO v_new_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client % not found in boutique %', p_client_id, v_boutique_id;
  END IF;

  INSERT INTO loyalty_transactions (boutique_id, client_id, delta, type, reason)
  VALUES (v_boutique_id, p_client_id, p_delta, p_type, p_reason)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('new_total', v_new_total);
END;
$$;


--
-- Name: check_boutique_name_exists(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_boutique_name_exists(p_name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM boutiques WHERE lower(trim(name)) = lower(trim(p_name))
  );
END;
$$;


--
-- Name: check_dress_availability(uuid, date, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_dress_availability(p_inventory_id uuid, p_start_date date, p_end_date date, p_exclude_event_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM events e
    WHERE e.id != COALESCE(p_exclude_event_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND e.event_date BETWEEN p_start_date AND p_end_date
  );
END; $$;


--
-- Name: check_email_exists(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_email_exists(p_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email)
  );
END;
$$;


--
-- Name: create_boutique_for_user(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_boutique_for_user(p_user_id uuid, p_boutique_name text, p_owner_email text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_boutique_id uuid;
  v_existing_count int;
BEGIN
  -- Guard: if user already belongs to any boutique, do nothing
  SELECT COUNT(*) INTO v_existing_count
  FROM boutique_members
  WHERE user_id = p_user_id;

  IF v_existing_count > 0 THEN
    RETURN;
  END IF;

  INSERT INTO boutiques (name, email)
  VALUES (p_boutique_name, p_owner_email)
  RETURNING id INTO v_boutique_id;

  INSERT INTO boutique_members (boutique_id, user_id, role, name)
  VALUES (v_boutique_id, p_user_id, 'owner', split_part(p_owner_email, '@', 1));

  INSERT INTO boutique_modules (boutique_id, module_id, enabled)
  SELECT v_boutique_id, m.module_id, true
  FROM (VALUES
    ('events'), ('clients'), ('staff'), ('settings'),
    ('dress_rental'), ('alterations'), ('decoration'), ('event_planning'), ('pos')
  ) AS m(module_id);
END;
$$;


--
-- Name: generate_boutique_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_boutique_slug(p_name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  base_slug text;
  candidate text;
  counter int := 0;
BEGIN
  base_slug := lower(regexp_replace(regexp_replace(p_name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'));
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  IF length(base_slug) < 3 THEN
    base_slug := base_slug || '-boutique';
  END IF;
  candidate := base_slug;
  WHILE EXISTS (SELECT 1 FROM boutiques WHERE slug = candidate) LOOP
    counter := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;
  RETURN candidate;
END;
$$;


--
-- Name: get_event_by_portal_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_event_by_portal_token(p_token uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: get_invite_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_invite_by_token(p_token text) RETURNS TABLE(boutique_id uuid, boutique_name text, email text, role text, expires_at timestamp with time zone, is_valid boolean)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    b.id           AS boutique_id,
    b.name         AS boutique_name,
    i.email,
    i.role,
    i.expires_at,
    (i.accepted_at IS NULL AND i.expires_at > now()) AS is_valid
  FROM boutique_invites i
  JOIN boutiques b ON b.id = i.boutique_id
  WHERE i.token = p_token;
$$;


--
-- Name: get_missing_appointments(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_missing_appointments(p_event_id uuid) RETURNS TABLE(appointment_type text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT unnest(ARRAY['Measurements','Final fitting','Pickup']::text[])
  EXCEPT
  SELECT type FROM appointments WHERE event_id = p_event_id;
END; $$;


--
-- Name: is_boutique_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_boutique_member(target_boutique_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM boutique_members
    WHERE boutique_id = target_boutique_id
      AND user_id = auth.uid()
  );
$$;


--
-- Name: is_member_of_boutique(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_member_of_boutique(bid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM boutique_members
    WHERE boutique_id = bid AND user_id = auth.uid()
  );
$$;


--
-- Name: log_audit_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  boutique_uuid uuid;
BEGIN
  -- Get boutique_id from the row
  boutique_uuid := COALESCE(NEW.boutique_id, OLD.boutique_id);

  INSERT INTO boutique_audit_log (boutique_id, action, table_name, row_id, before_data, after_data)
  VALUES (
    boutique_uuid,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: my_boutique_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_boutique_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT boutique_id
  FROM boutique_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;


--
-- Name: purge_stale_measurements(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_stale_measurements(p_boutique_id uuid, p_older_than_years integer DEFAULT 7) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM client_measurements
  WHERE boutique_id = p_boutique_id
    AND created_at < now() - make_interval(years => p_older_than_years);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


--
-- Name: send_invite(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_invite(p_email text, p_role text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_boutique_id uuid;
  v_token       text;
BEGIN
  SELECT my_boutique_id() INTO v_boutique_id;
  IF v_boutique_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not a boutique member');
  END IF;

  -- Cancel any existing pending invite for this email in this boutique
  DELETE FROM boutique_invites
  WHERE boutique_id = v_boutique_id
    AND email = lower(p_email)
    AND accepted_at IS NULL;

  INSERT INTO boutique_invites (boutique_id, email, role, invited_by)
  VALUES (v_boutique_id, lower(p_email), p_role, auth.uid())
  RETURNING token INTO v_token;

  RETURN jsonb_build_object('token', v_token);
END;
$$;


--
-- Name: set_boutique_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_boutique_slug() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_boutique_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_plan_tier(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_plan_tier() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ BEGIN NEW.plan_tier := NEW.plan; RETURN NEW; END; $$;


--
-- Name: update_booking_requests_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_booking_requests_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_usage_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: alteration_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alteration_jobs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    boutique_id uuid NOT NULL,
    client_id uuid,
    event_id uuid,
    garment text NOT NULL,
    seamstress_id uuid,
    status text DEFAULT 'measurement_needed'::text NOT NULL,
    price numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    deadline date,
    notes text,
    measurements jsonb DEFAULT '{}'::jsonb,
    before_image_url text,
    after_image_url text,
    CONSTRAINT alteration_jobs_status_check CHECK ((status = ANY (ARRAY['measurement_needed'::text, 'in_progress'::text, 'fitting_scheduled'::text, 'complete'::text])))
);


--
-- Name: alteration_work_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alteration_work_items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    job_id uuid NOT NULL,
    description text NOT NULL
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_id uuid,
    boutique_id uuid NOT NULL,
    type text NOT NULL,
    staff_id uuid,
    note text,
    scheduled_at timestamp with time zone,
    status text DEFAULT 'scheduled'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    date date,
    "time" time without time zone,
    client_name text,
    client_phone text,
    client_id uuid,
    CONSTRAINT appointments_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'done'::text, 'missing'::text, 'upcoming'::text, 'cancelled'::text])))
);

ALTER TABLE ONLY public.appointments REPLICA IDENTITY FULL;


--
-- Name: booking_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    client_name text NOT NULL,
    client_email text,
    client_phone text,
    event_type text DEFAULT 'other'::text NOT NULL,
    event_date date,
    guest_count integer,
    services jsonb DEFAULT '[]'::jsonb,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    contacted_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: boutique_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boutique_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    actor_id uuid,
    actor_name text,
    action text NOT NULL,
    table_name text NOT NULL,
    row_id uuid,
    before_data jsonb,
    after_data jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: boutique_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boutique_integrations (
    boutique_id uuid NOT NULL,
    qbo_access_token text,
    qbo_refresh_token text,
    qbo_realm_id text,
    qbo_connected_at timestamp with time zone,
    qbo_synced_at timestamp with time zone,
    mailchimp_api_key text,
    mailchimp_list_id text,
    mailchimp_connected_at timestamp with time zone,
    klaviyo_api_key text,
    klaviyo_list_id text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: boutique_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boutique_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'front_desk'::text NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    invited_by uuid,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: boutique_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boutique_members (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    boutique_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'staff'::text NOT NULL,
    name text,
    initials text,
    color text,
    created_at timestamp with time zone DEFAULT now(),
    commission_rate numeric(5,2) DEFAULT 0,
    CONSTRAINT boutique_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'coordinator'::text, 'seamstress'::text, 'front_desk'::text, 'decorator'::text, 'staff'::text])))
);


--
-- Name: boutique_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boutique_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    module_id text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    enabled_at timestamp with time zone,
    enabled_by text,
    disabled_at timestamp with time zone,
    disabled_by text,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: boutique_vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boutique_vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    contact_name text,
    phone text,
    email text,
    website text,
    notes text,
    rating integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT boutique_vendors_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: boutiques; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boutiques (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    address text,
    instagram text,
    booking_url text,
    created_at timestamp with time zone DEFAULT now(),
    slug text,
    plan text DEFAULT 'starter'::text NOT NULL,
    trial_ends_at timestamp with time zone DEFAULT (now() + '14 days'::interval),
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text DEFAULT 'trialing'::text,
    automations jsonb DEFAULT '{"sms2h": true, "sms24h": true, "winBack": false, "overdueAlert": true, "weeklyDigest": true, "reviewRequest": true, "returnReminder": true, "paymentReminder": true}'::jsonb,
    plan_tier text DEFAULT 'starter'::text,
    primary_color text DEFAULT '#C9697A'::text,
    logo_url text,
    measurement_retention_years integer DEFAULT 7,
    calendar_feed_token text DEFAULT (gen_random_uuid())::text,
    CONSTRAINT boutiques_measurement_retention_years_check CHECK (((measurement_retention_years >= 1) AND (measurement_retention_years <= 10))),
    CONSTRAINT boutiques_plan_check CHECK ((plan = ANY (ARRAY['starter'::text, 'growth'::text, 'pro'::text])))
);


--
-- Name: COLUMN boutiques.measurement_retention_years; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.boutiques.measurement_retention_years IS 'How many years to retain client measurement data. Default 7 (GDPR Art. 17 safe harbor). Range 1–10.';


--
-- Name: bug_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bug_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    submitted_by uuid,
    title text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    severity text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    screen_name text,
    boutique_name text,
    user_role text,
    browser_info text,
    submitted_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    admin_notes text,
    resolved_at timestamp with time zone,
    CONSTRAINT bug_reports_category_check CHECK ((category = ANY (ARRAY['ui_display'::text, 'data_issue'::text, 'feature_broken'::text, 'performance'::text, 'crash'::text, 'other'::text]))),
    CONSTRAINT bug_reports_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'high'::text, 'low'::text]))),
    CONSTRAINT bug_reports_status_check CHECK ((status = ANY (ARRAY['new'::text, 'triaged'::text, 'in_progress'::text, 'fixed'::text, 'wont_fix'::text])))
);


--
-- Name: checklist_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    boutique_id uuid NOT NULL,
    name text NOT NULL,
    event_type text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT checklist_templates_event_type_check CHECK ((event_type = ANY (ARRAY['wedding'::text, 'quince'::text, 'both'::text])))
);


--
-- Name: client_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    client_id uuid NOT NULL,
    type text DEFAULT 'note'::text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    body text,
    is_editable boolean DEFAULT true NOT NULL,
    author_name text DEFAULT 'Staff'::text NOT NULL,
    author_role text,
    duration_minutes integer,
    related_event_id uuid,
    points_awarded integer DEFAULT 0 NOT NULL,
    edited_at timestamp with time zone,
    edited_by_name text,
    original_body text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client_measurements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_measurements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    client_id uuid NOT NULL,
    label text DEFAULT 'Measurements'::text NOT NULL,
    bust numeric(6,2),
    waist numeric(6,2),
    hips numeric(6,2),
    height numeric(6,2),
    weight numeric(6,2),
    shoulder_width numeric(6,2),
    sleeve_length numeric(6,2),
    dress_length numeric(6,2),
    inseam numeric(6,2),
    neck numeric(6,2),
    notes text,
    recorded_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE client_measurements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.client_measurements IS 'PII — body measurements. Retained for duration of client relationship. Cascades on client delete. Max retention 7 years per GDPR Art. 17 / CCPA § 1798.105. Use request_data_deletion() or data_deletion_requests table for erasure requests.';


--
-- Name: client_tag_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_tag_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    boutique_id uuid NOT NULL,
    assigned_by_name text,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client_tag_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_tag_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'internal'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    client_id uuid NOT NULL,
    event_id uuid,
    text text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    is_alert boolean DEFAULT false NOT NULL,
    done boolean DEFAULT false NOT NULL,
    done_at timestamp with time zone,
    done_by_name text,
    assigned_to_id uuid,
    due_date date,
    created_by_name text DEFAULT 'Staff'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    boutique_id uuid NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    emergency_contact text,
    referred_by text,
    created_at timestamp with time zone DEFAULT now(),
    language_preference text DEFAULT 'en'::text NOT NULL,
    last_rating integer,
    loyalty_points integer DEFAULT 0 NOT NULL,
    partner_name text,
    flower_prefs text,
    comm_prefs jsonb,
    style_themes text[] DEFAULT '{}'::text[],
    birthday date,
    anniversary date,
    last_contacted_at timestamp with time zone,
    no_show_count integer DEFAULT 0,
    birth_date date,
    anniversary_date date,
    CONSTRAINT clients_language_preference_check CHECK ((language_preference = ANY (ARRAY['en'::text, 'es'::text]))),
    CONSTRAINT clients_last_rating_check CHECK (((last_rating >= 1) AND (last_rating <= 5)))
);


--
-- Name: commission_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    event_id uuid NOT NULL,
    member_id uuid,
    member_name text NOT NULL,
    event_total numeric(10,2) DEFAULT 0 NOT NULL,
    commission_rate numeric(5,2) DEFAULT 0 NOT NULL,
    commission_amount numeric(10,2) DEFAULT 0 NOT NULL,
    paid boolean DEFAULT false,
    paid_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    event_id uuid,
    client_id uuid,
    title text NOT NULL,
    body_html text,
    status text DEFAULT 'draft'::text NOT NULL,
    sign_token uuid DEFAULT gen_random_uuid() NOT NULL,
    signed_at timestamp with time zone,
    signed_by_name text,
    signature_data text,
    ip_address text,
    pdf_url text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    signed_ip text,
    signed_user_agent text,
    CONSTRAINT contracts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'signed'::text, 'voided'::text])))
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    category text DEFAULT 'general'::text,
    variables text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT email_templates_category_check CHECK ((category = ANY (ARRAY['general'::text, 'confirmation'::text, 'reminder'::text, 'followup'::text, 'promotion'::text, 'contract'::text])))
);


--
-- Name: event_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    event_id uuid NOT NULL,
    title text DEFAULT 'Service Agreement'::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    client_name text,
    client_email text,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    signed_at timestamp with time zone,
    signature_data text,
    ip_address text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT event_contracts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'signed'::text, 'voided'::text])))
);


--
-- Name: event_guests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_guests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    event_id uuid NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    rsvp_status text DEFAULT 'invited'::text NOT NULL,
    meal_pref text,
    table_number text,
    plus_ones integer DEFAULT 0,
    notes text,
    invited_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: event_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    event_id uuid NOT NULL,
    inventory_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    setup_time text,
    placement text,
    color_notes text,
    category_tag text,
    sort_order integer DEFAULT 0
);


--
-- Name: event_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    event_id uuid,
    client_id uuid,
    url text NOT NULL,
    storage_path text,
    caption text,
    photo_type text DEFAULT 'general'::text,
    uploaded_by text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT event_photos_photo_type_check CHECK ((photo_type = ANY (ARRAY['general'::text, 'fitting'::text, 'before'::text, 'after'::text, 'event_day'::text, 'inspiration'::text, 'dress'::text])))
);


--
-- Name: event_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_services (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    boutique_id uuid NOT NULL,
    service_type text NOT NULL,
    CONSTRAINT event_services_service_type_check CHECK ((service_type = ANY (ARRAY['dress_rental'::text, 'alterations'::text, 'planning'::text, 'decoration'::text, 'photography'::text, 'dj'::text])))
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    boutique_id uuid NOT NULL,
    client_id uuid NOT NULL,
    type text NOT NULL,
    event_date date NOT NULL,
    venue text,
    guests integer DEFAULT 0,
    coordinator_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    total numeric(10,2) DEFAULT 0,
    paid numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    last_reminder_sent_at timestamp with time zone,
    package_id uuid,
    inspiration_colors jsonb,
    inspiration_styles jsonb,
    inspiration_notes text,
    inspiration_florals text,
    quince_theme text,
    quince_waltz_song text,
    quince_cort_size_damas integer,
    quince_cort_size_chambelanes integer,
    venue_plan jsonb,
    portal_token uuid DEFAULT gen_random_uuid() NOT NULL,
    floorplan jsonb,
    decoration_plan jsonb DEFAULT '{}'::jsonb,
    day_checklist jsonb DEFAULT '[]'::jsonb,
    portal_token_expires_at timestamp with time zone,
    CONSTRAINT events_status_check CHECK ((status = ANY (ARRAY['active'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT events_type_check CHECK ((type = ANY (ARRAY['wedding'::text, 'quince'::text, 'baptism'::text, 'birthday'::text, 'anniversary'::text, 'graduation'::text, 'baby_shower'::text, 'bridal_shower'::text])))
);


--
-- Name: event_urgency; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.event_urgency WITH (security_invoker='true') AS
 SELECT id,
    boutique_id,
    client_id,
    type,
    event_date,
    status,
    total,
    paid,
    (EXTRACT(day FROM ((event_date)::timestamp with time zone - now())))::integer AS days_until
   FROM public.events e;


--
-- Name: event_vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    event_id uuid NOT NULL,
    vendor_id uuid NOT NULL,
    role text,
    confirmed boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    description text NOT NULL,
    amount numeric(10,2) DEFAULT 0 NOT NULL,
    vendor text,
    event_id uuid,
    receipt_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fb_beo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_beo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    event_id uuid,
    client_name text,
    event_date date,
    venue text,
    guest_count integer,
    setup_time text,
    service_start text,
    service_end text,
    menu_items jsonb DEFAULT '[]'::jsonb,
    service_timeline jsonb DEFAULT '[]'::jsonb,
    dietary_notes text,
    bar_notes text,
    special_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    boutique_id uuid NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    size text,
    color text,
    price numeric(10,2) NOT NULL,
    deposit numeric(10,2) NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    client_id uuid,
    return_date date,
    last_cleaned date,
    created_at timestamp with time zone DEFAULT now(),
    pickup_date date,
    return_date_confirmed date,
    notes text,
    condition text DEFAULT 'good'::text,
    "group" text,
    track text DEFAULT 'unique'::text,
    "totalQty" integer DEFAULT 1,
    "availQty" integer DEFAULT 1,
    "reservedQty" integer DEFAULT 0,
    "outQty" integer DEFAULT 0,
    "dmgQty" integer DEFAULT 0,
    "minStock" integer DEFAULT 1,
    "currentStock" integer DEFAULT 0,
    "restockPoint" integer DEFAULT 0,
    "restockQty" integer DEFAULT 0,
    unit text,
    image_url text,
    CONSTRAINT inventory_category_check CHECK ((category = ANY (ARRAY['bridal_gown'::text, 'quince_gown'::text, 'arch'::text, 'centerpiece'::text, 'linen'::text, 'lighting'::text, 'chair'::text, 'veil'::text, 'headpiece'::text, 'jewelry'::text, 'ceremony'::text, 'consumable'::text, 'equipment'::text]))),
    CONSTRAINT inventory_status_check CHECK ((status = ANY (ARRAY['available'::text, 'reserved'::text, 'picked_up'::text, 'returned'::text, 'cleaning'::text, 'overdue'::text])))
);


--
-- Name: TABLE inventory; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.inventory IS 'Inventory tracking schema updated';


--
-- Name: inventory_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    inventory_id uuid NOT NULL,
    action text NOT NULL,
    prev_status text,
    new_status text,
    user_name text,
    event_id uuid,
    client_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: loyalty_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    client_id uuid NOT NULL,
    delta integer NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    boutique_id uuid NOT NULL,
    author_id uuid,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payment_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_milestones (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    boutique_id uuid NOT NULL,
    label text NOT NULL,
    amount numeric(10,2) NOT NULL,
    due_date date,
    paid_date date,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_reminded_at timestamp with time zone,
    sort_order integer DEFAULT 0,
    stripe_payment_link_url text,
    stripe_payment_link_id text,
    CONSTRAINT chk_milestone_amount_positive CHECK ((amount > (0)::numeric)),
    CONSTRAINT payment_milestones_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text])))
);


--
-- Name: pipeline_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    client_id uuid,
    lead_name text,
    lead_phone text,
    stage text DEFAULT 'inquiry'::text NOT NULL,
    event_type text,
    estimated_event_date text,
    estimated_value integer DEFAULT 0 NOT NULL,
    source text,
    notes text,
    lost_reason text,
    assigned_to_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    converted_at timestamp with time zone,
    converted_event_id uuid
);


--
-- Name: portal_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    client_id uuid NOT NULL,
    event_id uuid,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    last_accessed_at timestamp with time zone
);


--
-- Name: promo_code_uses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_code_uses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    promo_code_id uuid NOT NULL,
    event_id uuid,
    client_name text,
    discount_applied numeric(10,2) NOT NULL,
    used_at timestamp with time zone DEFAULT now()
);


--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    code text NOT NULL,
    description text,
    discount_type text DEFAULT 'percent'::text NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    max_uses integer,
    uses_count integer DEFAULT 0 NOT NULL,
    expires_at date,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: questionnaire_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questionnaire_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    event_id uuid,
    client_name text,
    client_email text,
    answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    submitted_at timestamp with time zone DEFAULT now()
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    event_id uuid,
    client_name text NOT NULL,
    event_type text,
    event_date date,
    venue text,
    expires_at date,
    line_items jsonb DEFAULT '[]'::jsonb,
    milestones jsonb DEFAULT '[]'::jsonb,
    discount_type text DEFAULT 'fixed'::text,
    discount_value numeric(10,2) DEFAULT 0,
    notes text,
    status text DEFAULT 'draft'::text,
    pdf_url text,
    total numeric(10,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    client_id uuid,
    event_id uuid,
    rating integer,
    platform text DEFAULT 'internal'::text,
    review_text text,
    reviewer_name text,
    review_url text,
    request_sent_at timestamp with time zone,
    response text,
    responded_at timestamp with time zone,
    is_featured boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reviews_platform_check CHECK ((platform = ANY (ARRAY['internal'::text, 'google'::text, 'yelp'::text, 'facebook'::text, 'theknot'::text, 'weddingwire'::text, 'other'::text]))),
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: service_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    services text[] DEFAULT '{}'::text[] NOT NULL,
    base_price numeric(10,2) DEFAULT 0 NOT NULL,
    event_type text DEFAULT 'both'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT service_packages_event_type_check CHECK ((event_type = ANY (ARRAY['both'::text, 'wedding'::text, 'quince'::text])))
);


--
-- Name: sms_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    client_id uuid,
    direction text NOT NULL,
    from_number text,
    to_number text,
    body text NOT NULL,
    twilio_sid text,
    status text DEFAULT 'delivered'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sms_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))
);


--
-- Name: task_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    name text NOT NULL,
    event_type text,
    tasks jsonb DEFAULT '[]'::jsonb NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    boutique_id uuid NOT NULL,
    text text NOT NULL,
    category text,
    done boolean DEFAULT false NOT NULL,
    alert boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    assigned_to_id uuid,
    assigned_to_name text,
    due_date date,
    done_at timestamp with time zone,
    done_by_name text
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    phone text,
    email text,
    website text,
    instagram text,
    rating integer,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT vendors_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: wedding_budget_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wedding_budget_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    category text NOT NULL,
    item_name text NOT NULL,
    budgeted_cents integer DEFAULT 0,
    vendor_est_cents integer DEFAULT 0,
    actualized_cents integer DEFAULT 0,
    vendor_name text,
    vendor_contact text,
    deposit_cents integer DEFAULT 0,
    payment_due text,
    contract_url text,
    notes text,
    stage text DEFAULT 'pending'::text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: wedding_checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wedding_checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    phase text NOT NULL,
    task text NOT NULL,
    done boolean DEFAULT false,
    done_at timestamp with time zone,
    done_by_name text,
    due_date date,
    assigned_to text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: wedding_gifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wedding_gifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    guest_name text NOT NULL,
    gift_type text,
    item_description text,
    category text,
    amount_cents integer DEFAULT 0,
    received_date date,
    thank_you_sent boolean DEFAULT false,
    thank_you_sent_at timestamp with time zone,
    address text,
    phone text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: wedding_guests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wedding_guests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    name text NOT NULL,
    category text,
    address text,
    rsvp_status text DEFAULT 'waiting'::text,
    quantity integer DEFAULT 1,
    tier text DEFAULT 'nice'::text,
    table_number text,
    meal_choice text,
    dietary_prefs text,
    accommodations text,
    shuttle boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: wedding_legal_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wedding_legal_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    phase text NOT NULL,
    task text NOT NULL,
    type text,
    location text,
    cost text,
    notes text,
    done boolean DEFAULT false,
    done_at timestamp with time zone,
    sort_order integer DEFAULT 0
);


--
-- Name: wedding_music; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wedding_music (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    type text NOT NULL,
    moment_key text,
    song_title text,
    artist text,
    notes text,
    sort_order integer DEFAULT 0
);


--
-- Name: wedding_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wedding_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    event_id uuid NOT NULL,
    partner_1_name text,
    partner_2_name text,
    wedding_motto text,
    nuclear_option text,
    total_budget integer DEFAULT 0,
    guest_count integer DEFAULT 0,
    venue_budget_pct numeric DEFAULT 0.45,
    partner_1_priorities jsonb DEFAULT '[]'::jsonb,
    partner_2_priorities jsonb DEFAULT '[]'::jsonb,
    partner_1_not_important jsonb DEFAULT '[]'::jsonb,
    partner_2_not_important jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: wedding_run_of_show; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wedding_run_of_show (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    phase text NOT NULL,
    scheduled_time time without time zone,
    action text NOT NULL,
    details text,
    coordinator_notes text,
    photographer_notes text,
    dj_notes text,
    vendor_notes text,
    sort_order integer DEFAULT 0
);


--
-- Name: wedding_vendor_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wedding_vendor_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    vendor_id uuid NOT NULL,
    question text NOT NULL,
    answer text,
    asked_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: wedding_vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wedding_vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boutique_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    vendor_type text NOT NULL,
    company_name text,
    contact_name text,
    phone text,
    email text,
    website text,
    stage text DEFAULT 'sourcing'::text,
    total_cents integer DEFAULT 0,
    deposit_cents integer DEFAULT 0,
    deposit_due text,
    contract_url text,
    notes text,
    rating integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_usage_log ai_usage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_log
    ADD CONSTRAINT ai_usage_log_pkey PRIMARY KEY (id);


--
-- Name: alteration_jobs alteration_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alteration_jobs
    ADD CONSTRAINT alteration_jobs_pkey PRIMARY KEY (id);


--
-- Name: alteration_work_items alteration_work_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alteration_work_items
    ADD CONSTRAINT alteration_work_items_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: booking_requests booking_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_pkey PRIMARY KEY (id);


--
-- Name: boutique_audit_log boutique_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_audit_log
    ADD CONSTRAINT boutique_audit_log_pkey PRIMARY KEY (id);


--
-- Name: boutique_integrations boutique_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_integrations
    ADD CONSTRAINT boutique_integrations_pkey PRIMARY KEY (boutique_id);


--
-- Name: boutique_invites boutique_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_invites
    ADD CONSTRAINT boutique_invites_pkey PRIMARY KEY (id);


--
-- Name: boutique_invites boutique_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_invites
    ADD CONSTRAINT boutique_invites_token_key UNIQUE (token);


--
-- Name: boutique_members boutique_members_boutique_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_members
    ADD CONSTRAINT boutique_members_boutique_id_user_id_key UNIQUE (boutique_id, user_id);


--
-- Name: boutique_members boutique_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_members
    ADD CONSTRAINT boutique_members_pkey PRIMARY KEY (id);


--
-- Name: boutique_modules boutique_modules_boutique_id_module_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_modules
    ADD CONSTRAINT boutique_modules_boutique_id_module_id_key UNIQUE (boutique_id, module_id);


--
-- Name: boutique_modules boutique_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_modules
    ADD CONSTRAINT boutique_modules_pkey PRIMARY KEY (id);


--
-- Name: boutique_vendors boutique_vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_vendors
    ADD CONSTRAINT boutique_vendors_pkey PRIMARY KEY (id);


--
-- Name: boutiques boutiques_calendar_feed_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutiques
    ADD CONSTRAINT boutiques_calendar_feed_token_key UNIQUE (calendar_feed_token);


--
-- Name: boutiques boutiques_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutiques
    ADD CONSTRAINT boutiques_pkey PRIMARY KEY (id);


--
-- Name: boutiques boutiques_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutiques
    ADD CONSTRAINT boutiques_slug_key UNIQUE (slug);


--
-- Name: bug_reports bug_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bug_reports
    ADD CONSTRAINT bug_reports_pkey PRIMARY KEY (id);


--
-- Name: checklist_templates checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: client_interactions client_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_interactions
    ADD CONSTRAINT client_interactions_pkey PRIMARY KEY (id);


--
-- Name: client_measurements client_measurements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_measurements
    ADD CONSTRAINT client_measurements_pkey PRIMARY KEY (id);


--
-- Name: client_tag_assignments client_tag_assignments_client_id_tag_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tag_assignments
    ADD CONSTRAINT client_tag_assignments_client_id_tag_id_key UNIQUE (client_id, tag_id);


--
-- Name: client_tag_assignments client_tag_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tag_assignments
    ADD CONSTRAINT client_tag_assignments_pkey PRIMARY KEY (id);


--
-- Name: client_tag_definitions client_tag_definitions_boutique_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tag_definitions
    ADD CONSTRAINT client_tag_definitions_boutique_id_name_key UNIQUE (boutique_id, name);


--
-- Name: client_tag_definitions client_tag_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tag_definitions
    ADD CONSTRAINT client_tag_definitions_pkey PRIMARY KEY (id);


--
-- Name: client_tasks client_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tasks
    ADD CONSTRAINT client_tasks_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: commission_records commission_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_records
    ADD CONSTRAINT commission_records_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_sign_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_sign_token_key UNIQUE (sign_token);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: event_contracts event_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_contracts
    ADD CONSTRAINT event_contracts_pkey PRIMARY KEY (id);


--
-- Name: event_contracts event_contracts_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_contracts
    ADD CONSTRAINT event_contracts_token_key UNIQUE (token);


--
-- Name: event_guests event_guests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_guests
    ADD CONSTRAINT event_guests_pkey PRIMARY KEY (id);


--
-- Name: event_inventory event_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_inventory
    ADD CONSTRAINT event_inventory_pkey PRIMARY KEY (id);


--
-- Name: event_photos event_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_photos
    ADD CONSTRAINT event_photos_pkey PRIMARY KEY (id);


--
-- Name: event_services event_services_event_id_service_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_services
    ADD CONSTRAINT event_services_event_id_service_type_key UNIQUE (event_id, service_type);


--
-- Name: event_services event_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_services
    ADD CONSTRAINT event_services_pkey PRIMARY KEY (id);


--
-- Name: event_vendors event_vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_vendors
    ADD CONSTRAINT event_vendors_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: events events_portal_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_portal_token_key UNIQUE (portal_token);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: fb_beo fb_beo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_beo
    ADD CONSTRAINT fb_beo_pkey PRIMARY KEY (id);


--
-- Name: inventory_audit_log inventory_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_log
    ADD CONSTRAINT inventory_audit_log_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_boutique_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_boutique_id_sku_key UNIQUE (boutique_id, sku);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: loyalty_transactions loyalty_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: payment_milestones payment_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_milestones
    ADD CONSTRAINT payment_milestones_pkey PRIMARY KEY (id);


--
-- Name: pipeline_leads pipeline_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_leads
    ADD CONSTRAINT pipeline_leads_pkey PRIMARY KEY (id);


--
-- Name: portal_tokens portal_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_tokens
    ADD CONSTRAINT portal_tokens_pkey PRIMARY KEY (id);


--
-- Name: portal_tokens portal_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_tokens
    ADD CONSTRAINT portal_tokens_token_key UNIQUE (token);


--
-- Name: promo_code_uses promo_code_uses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_pkey PRIMARY KEY (id);


--
-- Name: promo_codes promo_codes_boutique_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_boutique_id_code_key UNIQUE (boutique_id, code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: questionnaire_submissions questionnaire_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questionnaire_submissions
    ADD CONSTRAINT questionnaire_submissions_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: service_packages service_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_packages
    ADD CONSTRAINT service_packages_pkey PRIMARY KEY (id);


--
-- Name: sms_messages sms_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_pkey PRIMARY KEY (id);


--
-- Name: task_templates task_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: wedding_budget_items wedding_budget_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_budget_items
    ADD CONSTRAINT wedding_budget_items_pkey PRIMARY KEY (id);


--
-- Name: wedding_checklist_items wedding_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_checklist_items
    ADD CONSTRAINT wedding_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: wedding_gifts wedding_gifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_gifts
    ADD CONSTRAINT wedding_gifts_pkey PRIMARY KEY (id);


--
-- Name: wedding_guests wedding_guests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_guests
    ADD CONSTRAINT wedding_guests_pkey PRIMARY KEY (id);


--
-- Name: wedding_legal_items wedding_legal_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_legal_items
    ADD CONSTRAINT wedding_legal_items_pkey PRIMARY KEY (id);


--
-- Name: wedding_music wedding_music_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_music
    ADD CONSTRAINT wedding_music_pkey PRIMARY KEY (id);


--
-- Name: wedding_plans wedding_plans_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_plans
    ADD CONSTRAINT wedding_plans_event_id_key UNIQUE (event_id);


--
-- Name: wedding_plans wedding_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_plans
    ADD CONSTRAINT wedding_plans_pkey PRIMARY KEY (id);


--
-- Name: wedding_run_of_show wedding_run_of_show_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_run_of_show
    ADD CONSTRAINT wedding_run_of_show_pkey PRIMARY KEY (id);


--
-- Name: wedding_vendor_questions wedding_vendor_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_vendor_questions
    ADD CONSTRAINT wedding_vendor_questions_pkey PRIMARY KEY (id);


--
-- Name: wedding_vendors wedding_vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_vendors
    ADD CONSTRAINT wedding_vendors_pkey PRIMARY KEY (id);


--
-- Name: bug_reports_boutique_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bug_reports_boutique_id_idx ON public.bug_reports USING btree (boutique_id);


--
-- Name: bug_reports_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bug_reports_status_idx ON public.bug_reports USING btree (status);


--
-- Name: bug_reports_submitted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bug_reports_submitted_at_idx ON public.bug_reports USING btree (submitted_at DESC);


--
-- Name: client_measurements_boutique_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_measurements_boutique_id_idx ON public.client_measurements USING btree (boutique_id);


--
-- Name: client_measurements_client_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_measurements_client_id_idx ON public.client_measurements USING btree (client_id);


--
-- Name: contracts_boutique_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contracts_boutique_id_idx ON public.contracts USING btree (boutique_id);


--
-- Name: contracts_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contracts_event_id_idx ON public.contracts USING btree (event_id);


--
-- Name: contracts_sign_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contracts_sign_token_idx ON public.contracts USING btree (sign_token);


--
-- Name: email_templates_boutique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_templates_boutique_idx ON public.email_templates USING btree (boutique_id);


--
-- Name: event_inventory_boutique_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_inventory_boutique_id_idx ON public.event_inventory USING btree (boutique_id);


--
-- Name: event_inventory_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_inventory_event_id_idx ON public.event_inventory USING btree (event_id);


--
-- Name: event_inventory_inventory_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_inventory_inventory_id_idx ON public.event_inventory USING btree (inventory_id);


--
-- Name: event_photos_boutique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_photos_boutique_idx ON public.event_photos USING btree (boutique_id);


--
-- Name: event_photos_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_photos_event_idx ON public.event_photos USING btree (event_id);


--
-- Name: events_portal_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_portal_token_idx ON public.events USING btree (portal_token);


--
-- Name: expenses_boutique_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_boutique_id_idx ON public.expenses USING btree (boutique_id);


--
-- Name: expenses_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_date_idx ON public.expenses USING btree (date DESC);


--
-- Name: idx_ai_usage_log_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_log_user_time ON public.ai_usage_log USING btree (user_id, created_at DESC);


--
-- Name: idx_alteration_jobs_boutique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alteration_jobs_boutique_id ON public.alteration_jobs USING btree (boutique_id);


--
-- Name: idx_appointments_boutique_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_boutique_date ON public.appointments USING btree (boutique_id, date);


--
-- Name: idx_appointments_boutique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_boutique_id ON public.appointments USING btree (boutique_id);


--
-- Name: idx_booking_requests_boutique; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_boutique ON public.booking_requests USING btree (boutique_id, created_at DESC);


--
-- Name: idx_booking_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_status ON public.booking_requests USING btree (boutique_id, status);


--
-- Name: idx_boutiques_stripe_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boutiques_stripe_customer ON public.boutiques USING btree (stripe_customer_id);


--
-- Name: idx_boutiques_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boutiques_subscription ON public.boutiques USING btree (stripe_subscription_id);


--
-- Name: idx_client_interactions_boutique; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_interactions_boutique ON public.client_interactions USING btree (boutique_id);


--
-- Name: idx_client_interactions_boutique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_interactions_boutique_id ON public.client_interactions USING btree (boutique_id);


--
-- Name: idx_client_interactions_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_interactions_client ON public.client_interactions USING btree (client_id);


--
-- Name: idx_client_measurements_boutique_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_measurements_boutique_created ON public.client_measurements USING btree (boutique_id, created_at);


--
-- Name: idx_client_tasks_boutique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_tasks_boutique_id ON public.client_tasks USING btree (boutique_id);


--
-- Name: idx_client_tasks_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_tasks_client ON public.client_tasks USING btree (client_id);


--
-- Name: idx_clients_boutique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_boutique_id ON public.clients USING btree (boutique_id);


--
-- Name: idx_events_boutique_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_boutique_date ON public.events USING btree (boutique_id, event_date);


--
-- Name: idx_events_boutique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_boutique_id ON public.events USING btree (boutique_id);


--
-- Name: idx_events_boutique_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_boutique_status ON public.events USING btree (boutique_id, status);


--
-- Name: idx_events_package_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_package_id ON public.events USING btree (package_id);


--
-- Name: idx_inventory_boutique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_boutique_id ON public.inventory USING btree (boutique_id);


--
-- Name: idx_inventory_boutique_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_boutique_status ON public.inventory USING btree (boutique_id, status);


--
-- Name: idx_loyalty_transactions_boutique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_transactions_boutique_id ON public.loyalty_transactions USING btree (boutique_id);


--
-- Name: idx_loyalty_transactions_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_transactions_client_id ON public.loyalty_transactions USING btree (client_id);


--
-- Name: idx_notes_boutique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_boutique_id ON public.notes USING btree (boutique_id);


--
-- Name: idx_payment_milestones_boutique_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_milestones_boutique_due ON public.payment_milestones USING btree (boutique_id, due_date);


--
-- Name: idx_payment_milestones_boutique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_milestones_boutique_id ON public.payment_milestones USING btree (boutique_id);


--
-- Name: idx_payment_milestones_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_milestones_event_id ON public.payment_milestones USING btree (event_id);


--
-- Name: idx_pipeline_leads_boutique; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_leads_boutique ON public.pipeline_leads USING btree (boutique_id);


--
-- Name: idx_pipeline_leads_boutique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_leads_boutique_id ON public.pipeline_leads USING btree (boutique_id);


--
-- Name: idx_pipeline_leads_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_leads_stage ON public.pipeline_leads USING btree (stage);


--
-- Name: idx_service_packages_boutique; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_packages_boutique ON public.service_packages USING btree (boutique_id, active);


--
-- Name: idx_tag_assignments_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tag_assignments_client ON public.client_tag_assignments USING btree (client_id);


--
-- Name: idx_tasks_boutique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_boutique_id ON public.tasks USING btree (boutique_id);


--
-- Name: reviews_boutique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reviews_boutique_idx ON public.reviews USING btree (boutique_id);


--
-- Name: sms_messages_boutique_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_messages_boutique_client_idx ON public.sms_messages USING btree (boutique_id, client_id);


--
-- Name: sms_messages_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_messages_created_at_idx ON public.sms_messages USING btree (created_at DESC);


--
-- Name: clients audit_clients; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_clients AFTER INSERT OR DELETE OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: contracts audit_contracts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_contracts AFTER INSERT OR DELETE OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: events audit_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_events AFTER INSERT OR DELETE OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: payment_milestones audit_payment_milestones; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_payment_milestones AFTER INSERT OR DELETE OR UPDATE ON public.payment_milestones FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: booking_requests booking_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_requests_updated_at BEFORE UPDATE ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.update_booking_requests_updated_at();


--
-- Name: boutiques boutique_slug_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER boutique_slug_trigger BEFORE INSERT ON public.boutiques FOR EACH ROW EXECUTE FUNCTION public.set_boutique_slug();


--
-- Name: boutiques boutiques_auto_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER boutiques_auto_slug BEFORE INSERT ON public.boutiques FOR EACH ROW EXECUTE FUNCTION public.set_boutique_slug();


--
-- Name: boutiques sync_plan_tier_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_plan_tier_trigger BEFORE INSERT OR UPDATE ON public.boutiques FOR EACH ROW EXECUTE FUNCTION public.sync_plan_tier();


--
-- Name: ai_usage_log ai_usage_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_log
    ADD CONSTRAINT ai_usage_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: alteration_jobs alteration_jobs_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alteration_jobs
    ADD CONSTRAINT alteration_jobs_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: alteration_jobs alteration_jobs_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alteration_jobs
    ADD CONSTRAINT alteration_jobs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: alteration_jobs alteration_jobs_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alteration_jobs
    ADD CONSTRAINT alteration_jobs_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);


--
-- Name: alteration_jobs alteration_jobs_seamstress_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alteration_jobs
    ADD CONSTRAINT alteration_jobs_seamstress_id_fkey FOREIGN KEY (seamstress_id) REFERENCES public.boutique_members(id);


--
-- Name: alteration_work_items alteration_work_items_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alteration_work_items
    ADD CONSTRAINT alteration_work_items_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.alteration_jobs(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.boutique_members(id);


--
-- Name: booking_requests booking_requests_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: boutique_audit_log boutique_audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_audit_log
    ADD CONSTRAINT boutique_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: boutique_audit_log boutique_audit_log_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_audit_log
    ADD CONSTRAINT boutique_audit_log_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: boutique_integrations boutique_integrations_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_integrations
    ADD CONSTRAINT boutique_integrations_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: boutique_invites boutique_invites_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_invites
    ADD CONSTRAINT boutique_invites_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: boutique_invites boutique_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_invites
    ADD CONSTRAINT boutique_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);


--
-- Name: boutique_members boutique_members_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_members
    ADD CONSTRAINT boutique_members_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: boutique_members boutique_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_members
    ADD CONSTRAINT boutique_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: boutique_modules boutique_modules_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_modules
    ADD CONSTRAINT boutique_modules_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: boutique_vendors boutique_vendors_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boutique_vendors
    ADD CONSTRAINT boutique_vendors_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: bug_reports bug_reports_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bug_reports
    ADD CONSTRAINT bug_reports_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: bug_reports bug_reports_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bug_reports
    ADD CONSTRAINT bug_reports_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: checklist_templates checklist_templates_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: client_interactions client_interactions_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_interactions
    ADD CONSTRAINT client_interactions_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: client_interactions client_interactions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_interactions
    ADD CONSTRAINT client_interactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_interactions client_interactions_related_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_interactions
    ADD CONSTRAINT client_interactions_related_event_id_fkey FOREIGN KEY (related_event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: client_measurements client_measurements_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_measurements
    ADD CONSTRAINT client_measurements_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: client_measurements client_measurements_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_measurements
    ADD CONSTRAINT client_measurements_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_tag_assignments client_tag_assignments_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tag_assignments
    ADD CONSTRAINT client_tag_assignments_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: client_tag_assignments client_tag_assignments_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tag_assignments
    ADD CONSTRAINT client_tag_assignments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_tag_assignments client_tag_assignments_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tag_assignments
    ADD CONSTRAINT client_tag_assignments_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.client_tag_definitions(id) ON DELETE CASCADE;


--
-- Name: client_tag_definitions client_tag_definitions_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tag_definitions
    ADD CONSTRAINT client_tag_definitions_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: client_tasks client_tasks_assigned_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tasks
    ADD CONSTRAINT client_tasks_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.boutique_members(id) ON DELETE SET NULL;


--
-- Name: client_tasks client_tasks_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tasks
    ADD CONSTRAINT client_tasks_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: client_tasks client_tasks_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tasks
    ADD CONSTRAINT client_tasks_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_tasks client_tasks_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tasks
    ADD CONSTRAINT client_tasks_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: clients clients_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: commission_records commission_records_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_records
    ADD CONSTRAINT commission_records_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: commission_records commission_records_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_records
    ADD CONSTRAINT commission_records_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: commission_records commission_records_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_records
    ADD CONSTRAINT commission_records_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.boutique_members(id) ON DELETE SET NULL;


--
-- Name: contracts contracts_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: contracts contracts_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: email_templates email_templates_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: event_contracts event_contracts_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_contracts
    ADD CONSTRAINT event_contracts_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: event_contracts event_contracts_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_contracts
    ADD CONSTRAINT event_contracts_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_guests event_guests_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_guests
    ADD CONSTRAINT event_guests_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: event_guests event_guests_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_guests
    ADD CONSTRAINT event_guests_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_inventory event_inventory_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_inventory
    ADD CONSTRAINT event_inventory_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: event_inventory event_inventory_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_inventory
    ADD CONSTRAINT event_inventory_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_inventory event_inventory_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_inventory
    ADD CONSTRAINT event_inventory_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE CASCADE;


--
-- Name: event_photos event_photos_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_photos
    ADD CONSTRAINT event_photos_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: event_photos event_photos_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_photos
    ADD CONSTRAINT event_photos_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: event_photos event_photos_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_photos
    ADD CONSTRAINT event_photos_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_services event_services_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_services
    ADD CONSTRAINT event_services_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: event_services event_services_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_services
    ADD CONSTRAINT event_services_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_vendors event_vendors_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_vendors
    ADD CONSTRAINT event_vendors_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: event_vendors event_vendors_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_vendors
    ADD CONSTRAINT event_vendors_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_vendors event_vendors_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_vendors
    ADD CONSTRAINT event_vendors_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: events events_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: events events_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: events events_coordinator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_coordinator_id_fkey FOREIGN KEY (coordinator_id) REFERENCES public.boutique_members(id);


--
-- Name: events events_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.service_packages(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: fb_beo fb_beo_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_beo
    ADD CONSTRAINT fb_beo_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: fb_beo fb_beo_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_beo
    ADD CONSTRAINT fb_beo_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: inventory_audit_log inventory_audit_log_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_log
    ADD CONSTRAINT inventory_audit_log_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: inventory_audit_log inventory_audit_log_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_log
    ADD CONSTRAINT inventory_audit_log_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: inventory_audit_log inventory_audit_log_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_log
    ADD CONSTRAINT inventory_audit_log_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE CASCADE;


--
-- Name: inventory inventory_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: inventory inventory_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: loyalty_transactions loyalty_transactions_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: loyalty_transactions loyalty_transactions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: notes notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.boutique_members(id);


--
-- Name: notes notes_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: notes notes_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: payment_milestones payment_milestones_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_milestones
    ADD CONSTRAINT payment_milestones_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: payment_milestones payment_milestones_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_milestones
    ADD CONSTRAINT payment_milestones_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: pipeline_leads pipeline_leads_assigned_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_leads
    ADD CONSTRAINT pipeline_leads_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.boutique_members(id) ON DELETE SET NULL;


--
-- Name: pipeline_leads pipeline_leads_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_leads
    ADD CONSTRAINT pipeline_leads_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: pipeline_leads pipeline_leads_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_leads
    ADD CONSTRAINT pipeline_leads_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: pipeline_leads pipeline_leads_converted_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_leads
    ADD CONSTRAINT pipeline_leads_converted_event_id_fkey FOREIGN KEY (converted_event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: portal_tokens portal_tokens_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_tokens
    ADD CONSTRAINT portal_tokens_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: portal_tokens portal_tokens_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_tokens
    ADD CONSTRAINT portal_tokens_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: portal_tokens portal_tokens_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_tokens
    ADD CONSTRAINT portal_tokens_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: promo_code_uses promo_code_uses_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: promo_code_uses promo_code_uses_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: promo_code_uses promo_code_uses_promo_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_uses
    ADD CONSTRAINT promo_code_uses_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE CASCADE;


--
-- Name: promo_codes promo_codes_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: questionnaire_submissions questionnaire_submissions_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questionnaire_submissions
    ADD CONSTRAINT questionnaire_submissions_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: questionnaire_submissions questionnaire_submissions_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questionnaire_submissions
    ADD CONSTRAINT questionnaire_submissions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: service_packages service_packages_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_packages
    ADD CONSTRAINT service_packages_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: sms_messages sms_messages_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: sms_messages sms_messages_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: task_templates task_templates_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assigned_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.boutique_members(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: vendors vendors_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: wedding_budget_items wedding_budget_items_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_budget_items
    ADD CONSTRAINT wedding_budget_items_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: wedding_budget_items wedding_budget_items_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_budget_items
    ADD CONSTRAINT wedding_budget_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.wedding_plans(id) ON DELETE CASCADE;


--
-- Name: wedding_checklist_items wedding_checklist_items_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_checklist_items
    ADD CONSTRAINT wedding_checklist_items_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: wedding_checklist_items wedding_checklist_items_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_checklist_items
    ADD CONSTRAINT wedding_checklist_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.wedding_plans(id) ON DELETE CASCADE;


--
-- Name: wedding_gifts wedding_gifts_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_gifts
    ADD CONSTRAINT wedding_gifts_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: wedding_gifts wedding_gifts_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_gifts
    ADD CONSTRAINT wedding_gifts_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.wedding_plans(id) ON DELETE CASCADE;


--
-- Name: wedding_guests wedding_guests_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_guests
    ADD CONSTRAINT wedding_guests_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: wedding_guests wedding_guests_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_guests
    ADD CONSTRAINT wedding_guests_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.wedding_plans(id) ON DELETE CASCADE;


--
-- Name: wedding_legal_items wedding_legal_items_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_legal_items
    ADD CONSTRAINT wedding_legal_items_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: wedding_legal_items wedding_legal_items_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_legal_items
    ADD CONSTRAINT wedding_legal_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.wedding_plans(id) ON DELETE CASCADE;


--
-- Name: wedding_music wedding_music_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_music
    ADD CONSTRAINT wedding_music_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: wedding_music wedding_music_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_music
    ADD CONSTRAINT wedding_music_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.wedding_plans(id) ON DELETE CASCADE;


--
-- Name: wedding_plans wedding_plans_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_plans
    ADD CONSTRAINT wedding_plans_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: wedding_plans wedding_plans_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_plans
    ADD CONSTRAINT wedding_plans_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: wedding_run_of_show wedding_run_of_show_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_run_of_show
    ADD CONSTRAINT wedding_run_of_show_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: wedding_run_of_show wedding_run_of_show_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_run_of_show
    ADD CONSTRAINT wedding_run_of_show_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.wedding_plans(id) ON DELETE CASCADE;


--
-- Name: wedding_vendor_questions wedding_vendor_questions_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_vendor_questions
    ADD CONSTRAINT wedding_vendor_questions_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: wedding_vendor_questions wedding_vendor_questions_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_vendor_questions
    ADD CONSTRAINT wedding_vendor_questions_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.wedding_vendors(id) ON DELETE CASCADE;


--
-- Name: wedding_vendors wedding_vendors_boutique_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_vendors
    ADD CONSTRAINT wedding_vendors_boutique_id_fkey FOREIGN KEY (boutique_id) REFERENCES public.boutiques(id) ON DELETE CASCADE;


--
-- Name: wedding_vendors wedding_vendors_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wedding_vendors
    ADD CONSTRAINT wedding_vendors_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.wedding_plans(id) ON DELETE CASCADE;


--
-- Name: ai_usage_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

--
-- Name: alteration_jobs alt_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alt_delete ON public.alteration_jobs FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = alteration_jobs.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: alteration_jobs alt_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alt_insert ON public.alteration_jobs FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = alteration_jobs.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: alteration_jobs alt_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alt_select ON public.alteration_jobs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = alteration_jobs.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: alteration_jobs alt_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alt_update ON public.alteration_jobs FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = alteration_jobs.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: alteration_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alteration_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: alteration_work_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alteration_work_items ENABLE ROW LEVEL SECURITY;

--
-- Name: alteration_work_items altitems_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY altitems_delete ON public.alteration_work_items FOR DELETE USING ((job_id IN ( SELECT alteration_jobs.id
   FROM public.alteration_jobs
  WHERE (alteration_jobs.boutique_id IN ( SELECT boutique_members.boutique_id
           FROM public.boutique_members
          WHERE (boutique_members.user_id = auth.uid()))))));


--
-- Name: alteration_work_items altitems_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY altitems_insert ON public.alteration_work_items FOR INSERT WITH CHECK ((job_id IN ( SELECT alteration_jobs.id
   FROM public.alteration_jobs
  WHERE (alteration_jobs.boutique_id IN ( SELECT boutique_members.boutique_id
           FROM public.boutique_members
          WHERE (boutique_members.user_id = auth.uid()))))));


--
-- Name: alteration_work_items altitems_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY altitems_select ON public.alteration_work_items FOR SELECT USING ((job_id IN ( SELECT alteration_jobs.id
   FROM public.alteration_jobs
  WHERE (alteration_jobs.boutique_id IN ( SELECT boutique_members.boutique_id
           FROM public.boutique_members
          WHERE (boutique_members.user_id = auth.uid()))))));


--
-- Name: boutiques anon_boutique_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_boutique_view ON public.boutiques FOR SELECT TO anon USING (true);


--
-- Name: pipeline_leads anon_lead_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_lead_insert ON public.pipeline_leads FOR INSERT TO anon WITH CHECK ((boutique_id IN ( SELECT boutiques.id
   FROM public.boutiques)));


--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments appointments_kiosk_tryon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_kiosk_tryon_insert ON public.appointments FOR INSERT TO anon WITH CHECK (((event_id IS NULL) AND (type = 'consultation'::text) AND (status = 'scheduled'::text) AND (EXISTS ( SELECT 1
   FROM public.boutiques
  WHERE (boutiques.id = appointments.boutique_id)))));


--
-- Name: appointments appointments_kiosk_walkin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_kiosk_walkin_insert ON public.appointments FOR INSERT TO anon WITH CHECK (((event_id IS NULL) AND (type = 'walk_in'::text) AND (EXISTS ( SELECT 1
   FROM public.boutiques
  WHERE (boutiques.id = appointments.boutique_id)))));


--
-- Name: appointments appt_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appt_delete ON public.appointments FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = appointments.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: appointments appt_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appt_insert ON public.appointments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = appointments.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: appointments appt_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appt_select ON public.appointments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = appointments.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: appointments appt_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appt_update ON public.appointments FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = appointments.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: appointments appts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appts_delete ON public.appointments FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: appointments appts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appts_insert ON public.appointments FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: appointments appts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appts_select ON public.appointments FOR SELECT USING ((boutique_id = public.my_boutique_id()));


--
-- Name: appointments appts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appts_update ON public.appointments FOR UPDATE USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: client_measurements bm_cm_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_cm_delete ON public.client_measurements FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: client_measurements bm_cm_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_cm_insert ON public.client_measurements FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: client_measurements bm_cm_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_cm_select ON public.client_measurements USING ((boutique_id = public.my_boutique_id()));


--
-- Name: client_measurements bm_cm_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_cm_update ON public.client_measurements FOR UPDATE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: commission_records bm_cr_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_cr_delete ON public.commission_records FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: commission_records bm_cr_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_cr_insert ON public.commission_records FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: commission_records bm_cr_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_cr_select ON public.commission_records USING ((boutique_id = public.my_boutique_id()));


--
-- Name: commission_records bm_cr_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_cr_update ON public.commission_records FOR UPDATE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: event_guests bm_eg_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_eg_delete ON public.event_guests FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: event_guests bm_eg_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_eg_insert ON public.event_guests FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: event_guests bm_eg_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_eg_select ON public.event_guests USING ((boutique_id = public.my_boutique_id()));


--
-- Name: event_guests bm_eg_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_eg_update ON public.event_guests FOR UPDATE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: inventory_audit_log bm_ial_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_ial_insert ON public.inventory_audit_log FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: inventory_audit_log bm_ial_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_ial_select ON public.inventory_audit_log USING ((boutique_id = public.my_boutique_id()));


--
-- Name: promo_codes bm_pc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_pc ON public.promo_codes USING ((boutique_id = public.my_boutique_id()));


--
-- Name: promo_codes bm_pc_d; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_pc_d ON public.promo_codes FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: promo_codes bm_pc_i; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_pc_i ON public.promo_codes FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: promo_codes bm_pc_u; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_pc_u ON public.promo_codes FOR UPDATE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: promo_code_uses bm_pcu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_pcu ON public.promo_code_uses USING ((boutique_id = public.my_boutique_id()));


--
-- Name: promo_code_uses bm_pcu_i; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_pcu_i ON public.promo_code_uses FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: push_subscriptions bm_ps_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_ps_delete ON public.push_subscriptions FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: push_subscriptions bm_ps_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_ps_insert ON public.push_subscriptions FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: push_subscriptions bm_ps_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bm_ps_select ON public.push_subscriptions USING ((boutique_id = public.my_boutique_id()));


--
-- Name: booking_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates boutique members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "boutique members" ON public.email_templates USING ((boutique_id = public.my_boutique_id()));


--
-- Name: event_photos boutique members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "boutique members" ON public.event_photos USING ((boutique_id = public.my_boutique_id()));


--
-- Name: reviews boutique members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "boutique members" ON public.reviews USING ((boutique_id = public.my_boutique_id()));


--
-- Name: sms_messages boutique members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "boutique members" ON public.sms_messages USING ((boutique_id = public.my_boutique_id()));


--
-- Name: event_inventory boutique members can manage event_inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "boutique members can manage event_inventory" ON public.event_inventory TO authenticated USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: event_vendors boutique members can manage event_vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "boutique members can manage event_vendors" ON public.event_vendors USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: expenses boutique members can manage expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "boutique members can manage expenses" ON public.expenses USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: contracts boutique members manage contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "boutique members manage contracts" ON public.contracts USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: boutique_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boutique_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_code_uses boutique_delete_promo_code_uses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_delete_promo_code_uses ON public.promo_code_uses FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: boutique_integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boutique_integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: boutique_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boutique_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: wedding_budget_items boutique_manage_budget; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_manage_budget ON public.wedding_budget_items USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_checklist_items boutique_manage_checklist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_manage_checklist ON public.wedding_checklist_items USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_gifts boutique_manage_gifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_manage_gifts ON public.wedding_gifts USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_guests boutique_manage_guests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_manage_guests ON public.wedding_guests USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_legal_items boutique_manage_legal; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_manage_legal ON public.wedding_legal_items USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_music boutique_manage_music; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_manage_music ON public.wedding_music USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_run_of_show boutique_manage_run_of_show; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_manage_run_of_show ON public.wedding_run_of_show USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_vendors boutique_manage_vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_manage_vendors ON public.wedding_vendors USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_plans boutique_manage_wedding_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_manage_wedding_plans ON public.wedding_plans USING ((boutique_id = public.my_boutique_id()));


--
-- Name: client_interactions boutique_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_member_access ON public.client_interactions USING ((boutique_id IN ( SELECT boutique_members.boutique_id
   FROM public.boutique_members
  WHERE (boutique_members.user_id = auth.uid())))) WITH CHECK ((boutique_id IN ( SELECT boutique_members.boutique_id
   FROM public.boutique_members
  WHERE (boutique_members.user_id = auth.uid()))));


--
-- Name: client_tag_assignments boutique_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_member_access ON public.client_tag_assignments USING ((boutique_id IN ( SELECT boutique_members.boutique_id
   FROM public.boutique_members
  WHERE (boutique_members.user_id = auth.uid())))) WITH CHECK ((boutique_id IN ( SELECT boutique_members.boutique_id
   FROM public.boutique_members
  WHERE (boutique_members.user_id = auth.uid()))));


--
-- Name: client_tag_definitions boutique_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_member_access ON public.client_tag_definitions USING ((boutique_id IN ( SELECT boutique_members.boutique_id
   FROM public.boutique_members
  WHERE (boutique_members.user_id = auth.uid())))) WITH CHECK ((boutique_id IN ( SELECT boutique_members.boutique_id
   FROM public.boutique_members
  WHERE (boutique_members.user_id = auth.uid()))));


--
-- Name: client_tasks boutique_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_member_access ON public.client_tasks USING ((boutique_id IN ( SELECT boutique_members.boutique_id
   FROM public.boutique_members
  WHERE (boutique_members.user_id = auth.uid())))) WITH CHECK ((boutique_id IN ( SELECT boutique_members.boutique_id
   FROM public.boutique_members
  WHERE (boutique_members.user_id = auth.uid()))));


--
-- Name: pipeline_leads boutique_member_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_member_access ON public.pipeline_leads USING ((boutique_id IN ( SELECT boutique_members.boutique_id
   FROM public.boutique_members
  WHERE (boutique_members.user_id = auth.uid())))) WITH CHECK ((boutique_id IN ( SELECT boutique_members.boutique_id
   FROM public.boutique_members
  WHERE (boutique_members.user_id = auth.uid()))));


--
-- Name: boutique_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boutique_members ENABLE ROW LEVEL SECURITY;

--
-- Name: boutique_modules boutique_members_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_access ON public.boutique_modules USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: client_measurements boutique_members_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_access ON public.client_measurements USING ((boutique_id = public.my_boutique_id()));


--
-- Name: fb_beo boutique_members_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_access ON public.fb_beo USING ((boutique_id = public.my_boutique_id()));


--
-- Name: service_packages boutique_members_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_access ON public.service_packages USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: event_contracts boutique_members_all_event_contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_all_event_contracts ON public.event_contracts USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: expenses boutique_members_all_expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_all_expenses ON public.expenses USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: portal_tokens boutique_members_all_portal_tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_all_portal_tokens ON public.portal_tokens USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: sms_messages boutique_members_all_sms_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_all_sms_messages ON public.sms_messages USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: task_templates boutique_members_all_task_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_all_task_templates ON public.task_templates USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: boutique_vendors boutique_members_all_vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_all_vendors ON public.boutique_vendors USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: boutique_members boutique_members_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_delete ON public.boutique_members FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: event_vendors boutique_members_event_vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_event_vendors ON public.event_vendors USING ((boutique_id = public.my_boutique_id()));


--
-- Name: event_vendors boutique_members_event_vendors_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_event_vendors_delete ON public.event_vendors FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: event_vendors boutique_members_event_vendors_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_event_vendors_insert ON public.event_vendors FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: expenses boutique_members_expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_expenses ON public.expenses USING ((boutique_id = public.my_boutique_id()));


--
-- Name: expenses boutique_members_expenses_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_expenses_delete ON public.expenses FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: expenses boutique_members_expenses_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_expenses_insert ON public.expenses FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: expenses boutique_members_expenses_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_expenses_update ON public.expenses FOR UPDATE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: boutique_members boutique_members_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_insert ON public.boutique_members FOR INSERT WITH CHECK (((boutique_id = public.my_boutique_id()) OR (auth.uid() IN ( SELECT boutique_members_1.user_id
   FROM public.boutique_members boutique_members_1
  WHERE ((boutique_members_1.boutique_id = boutique_members_1.boutique_id) AND (boutique_members_1.role = 'owner'::text))))));


--
-- Name: loyalty_transactions boutique_members_loyalty; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_loyalty ON public.loyalty_transactions USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: contracts boutique_members_manage_contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_manage_contracts ON public.contracts USING ((boutique_id IN ( SELECT boutique_members.boutique_id
   FROM public.boutique_members
  WHERE (boutique_members.user_id = auth.uid())))) WITH CHECK ((boutique_id IN ( SELECT boutique_members.boutique_id
   FROM public.boutique_members
  WHERE (boutique_members.user_id = auth.uid()))));


--
-- Name: payment_milestones boutique_members_milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_milestones ON public.payment_milestones USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: push_subscriptions boutique_members_push; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_push ON public.push_subscriptions USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: quotes boutique_members_quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_quotes ON public.quotes USING ((boutique_id = public.my_boutique_id()));


--
-- Name: quotes boutique_members_quotes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_quotes_delete ON public.quotes FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: quotes boutique_members_quotes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_quotes_insert ON public.quotes FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: quotes boutique_members_quotes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_quotes_update ON public.quotes FOR UPDATE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: boutique_audit_log boutique_members_read_audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_read_audit ON public.boutique_audit_log FOR SELECT USING ((boutique_id = public.my_boutique_id()));


--
-- Name: questionnaire_submissions boutique_members_read_questionnaires; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_read_questionnaires ON public.questionnaire_submissions FOR SELECT USING ((boutique_id = public.my_boutique_id()));


--
-- Name: vendors boutique_members_vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_vendors ON public.vendors USING ((boutique_id = public.my_boutique_id()));


--
-- Name: vendors boutique_members_vendors_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_vendors_delete ON public.vendors FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: vendors boutique_members_vendors_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_vendors_insert ON public.vendors FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: vendors boutique_members_vendors_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_members_vendors_update ON public.vendors FOR UPDATE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: boutique_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boutique_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_code_uses boutique_update_promo_code_uses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boutique_update_promo_code_uses ON public.promo_code_uses FOR UPDATE USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: boutique_vendors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boutique_vendors ENABLE ROW LEVEL SECURITY;

--
-- Name: boutiques; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boutiques ENABLE ROW LEVEL SECURITY;

--
-- Name: bug_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: bug_reports bug_reports_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bug_reports_insert ON public.bug_reports FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: bug_reports bug_reports_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bug_reports_select ON public.bug_reports FOR SELECT USING ((boutique_id = public.my_boutique_id()));


--
-- Name: bug_reports bug_reports_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bug_reports_update ON public.bug_reports FOR UPDATE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: checklist_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_templates checklist_templates_boutique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_templates_boutique ON public.checklist_templates USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: clients cli_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cli_delete ON public.clients FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = clients.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: clients cli_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cli_insert ON public.clients FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = clients.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: clients cli_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cli_select ON public.clients FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = clients.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: clients cli_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cli_update ON public.clients FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = clients.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: client_interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

--
-- Name: client_measurements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_measurements ENABLE ROW LEVEL SECURITY;

--
-- Name: client_tag_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_tag_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: client_tag_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_tag_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: client_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: event_inventory einv_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY einv_delete ON public.event_inventory FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = event_inventory.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: event_inventory einv_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY einv_insert ON public.event_inventory FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = event_inventory.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: event_inventory einv_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY einv_select ON public.event_inventory FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = event_inventory.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: event_inventory einv_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY einv_update ON public.event_inventory FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = event_inventory.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: event_services esvc_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esvc_delete ON public.event_services FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = event_services.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: event_services esvc_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esvc_insert ON public.event_services FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = event_services.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: event_services esvc_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esvc_select ON public.event_services FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = event_services.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: event_contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: event_guests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_guests ENABLE ROW LEVEL SECURITY;

--
-- Name: event_inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: event_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: event_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_services ENABLE ROW LEVEL SECURITY;

--
-- Name: event_vendors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_vendors ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: events evt_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evt_delete ON public.events FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = events.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: events evt_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evt_insert ON public.events FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = events.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: events evt_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evt_select ON public.events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = events.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: events evt_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evt_update ON public.events FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = events.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: event_services evtsvc_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evtsvc_delete ON public.event_services FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: event_services evtsvc_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evtsvc_insert ON public.event_services FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: event_services evtsvc_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evtsvc_select ON public.event_services FOR SELECT USING ((boutique_id = public.my_boutique_id()));


--
-- Name: event_services evtsvc_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evtsvc_update ON public.event_services FOR UPDATE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_beo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_beo ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory inv_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inv_delete ON public.inventory FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = inventory.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: inventory inv_insert2; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inv_insert2 ON public.inventory FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = inventory.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: inventory inv_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inv_select ON public.inventory FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = inventory.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: inventory inv_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inv_update ON public.inventory FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = inventory.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory inventory_kiosk_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_kiosk_anon_select ON public.inventory FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.boutiques
  WHERE (boutiques.id = inventory.boutique_id))));


--
-- Name: loyalty_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: boutiques members read own boutique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read own boutique" ON public.boutiques FOR SELECT USING (public.is_member_of_boutique(id));


--
-- Name: boutiques members update own boutique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members update own boutique" ON public.boutiques FOR UPDATE USING (public.is_member_of_boutique(id));


--
-- Name: wedding_budget_items members_access_budget; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_access_budget ON public.wedding_budget_items USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_checklist_items members_access_checklist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_access_checklist ON public.wedding_checklist_items USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_gifts members_access_gifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_access_gifts ON public.wedding_gifts USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_guests members_access_guests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_access_guests ON public.wedding_guests USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_legal_items members_access_legal; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_access_legal ON public.wedding_legal_items USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_music members_access_music; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_access_music ON public.wedding_music USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_run_of_show members_access_ros; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_access_ros ON public.wedding_run_of_show USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_vendor_questions members_access_vendor_questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_access_vendor_questions ON public.wedding_vendor_questions USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_vendors members_access_vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_access_vendors ON public.wedding_vendors USING ((boutique_id = public.my_boutique_id()));


--
-- Name: wedding_plans members_access_wedding_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_access_wedding_plans ON public.wedding_plans USING ((boutique_id = public.my_boutique_id()));


--
-- Name: boutique_invites members_manage_invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_manage_invites ON public.boutique_invites USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: booking_requests members_read_bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_read_bookings ON public.booking_requests FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = booking_requests.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: booking_requests members_update_bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_update_bookings ON public.booking_requests FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = booking_requests.boutique_id) AND (boutique_members.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = booking_requests.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: payment_milestones milestones_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY milestones_delete ON public.payment_milestones FOR DELETE USING ((boutique_id = public.my_boutique_id()));


--
-- Name: payment_milestones milestones_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY milestones_insert ON public.payment_milestones FOR INSERT WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: payment_milestones milestones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY milestones_select ON public.payment_milestones FOR SELECT USING ((boutique_id = public.my_boutique_id()));


--
-- Name: payment_milestones milestones_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY milestones_update ON public.payment_milestones FOR UPDATE USING ((boutique_id = public.my_boutique_id())) WITH CHECK ((boutique_id = public.my_boutique_id()));


--
-- Name: notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

--
-- Name: notes notes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_delete ON public.notes FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = notes.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: notes notes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_insert ON public.notes FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = notes.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: notes notes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_select ON public.notes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = notes.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: notes notes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_update ON public.notes FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = notes.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: boutique_integrations owner_only_integrations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_only_integrations_delete ON public.boutique_integrations FOR DELETE TO authenticated USING (((boutique_id = public.my_boutique_id()) AND (EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.user_id = auth.uid()) AND (boutique_members.boutique_id = boutique_integrations.boutique_id) AND (boutique_members.role = 'owner'::text))))));


--
-- Name: boutique_integrations owner_only_integrations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_only_integrations_insert ON public.boutique_integrations FOR INSERT TO authenticated WITH CHECK (((boutique_id = public.my_boutique_id()) AND (EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.user_id = auth.uid()) AND (boutique_members.boutique_id = boutique_integrations.boutique_id) AND (boutique_members.role = 'owner'::text))))));


--
-- Name: boutique_integrations owner_only_integrations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_only_integrations_select ON public.boutique_integrations FOR SELECT USING (((boutique_id = public.my_boutique_id()) AND (EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.user_id = auth.uid()) AND (boutique_members.boutique_id = boutique_integrations.boutique_id) AND (boutique_members.role = 'owner'::text))))));


--
-- Name: boutique_integrations owner_only_integrations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_only_integrations_update ON public.boutique_integrations FOR UPDATE TO authenticated USING (((boutique_id = public.my_boutique_id()) AND (EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.user_id = auth.uid()) AND (boutique_members.boutique_id = boutique_integrations.boutique_id) AND (boutique_members.role = 'owner'::text)))))) WITH CHECK (((boutique_id = public.my_boutique_id()) AND (EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.user_id = auth.uid()) AND (boutique_members.boutique_id = boutique_integrations.boutique_id) AND (boutique_members.role = 'owner'::text))))));


--
-- Name: payment_milestones pay_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pay_delete ON public.payment_milestones FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = payment_milestones.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: payment_milestones pay_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pay_insert ON public.payment_milestones FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = payment_milestones.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: payment_milestones pay_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pay_select ON public.payment_milestones FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = payment_milestones.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: payment_milestones pay_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pay_update ON public.payment_milestones FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = payment_milestones.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: payment_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pipeline_leads ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portal_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_code_uses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts public read by token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read by token" ON public.contracts FOR SELECT USING (true);


--
-- Name: booking_requests public_can_submit_booking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_can_submit_booking ON public.booking_requests FOR INSERT WITH CHECK (true);


--
-- Name: contracts public_read_contract_by_token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_contract_by_token ON public.contracts FOR SELECT USING (((boutique_id IN ( SELECT boutique_members.boutique_id
   FROM public.boutique_members
  WHERE (boutique_members.user_id = auth.uid()))) OR (auth.role() = 'anon'::text) OR (auth.role() = 'service_role'::text)));


--
-- Name: events public_read_event_by_portal_token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_event_by_portal_token ON public.events FOR SELECT USING (true);


--
-- Name: event_contracts public_read_event_contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_event_contracts ON public.event_contracts FOR SELECT USING (true);


--
-- Name: portal_tokens public_read_portal_tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_portal_tokens ON public.portal_tokens FOR SELECT USING (true);


--
-- Name: event_contracts public_sign_event_contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_sign_event_contracts ON public.event_contracts FOR UPDATE USING ((status = 'sent'::text)) WITH CHECK ((status = 'signed'::text));


--
-- Name: questionnaire_submissions public_submit_questionnaire; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_submit_questionnaire ON public.questionnaire_submissions FOR INSERT WITH CHECK ((boutique_id IN ( SELECT boutiques.id
   FROM public.boutiques)));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: questionnaire_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.questionnaire_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: boutique_members see own boutique members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "see own boutique members" ON public.boutique_members FOR SELECT USING (public.is_member_of_boutique(boutique_id));


--
-- Name: boutique_audit_log service_insert_audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_insert_audit ON public.boutique_audit_log FOR INSERT WITH CHECK (true);


--
-- Name: sms_messages service_insert_sms_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_insert_sms_messages ON public.sms_messages FOR INSERT WITH CHECK (true);


--
-- Name: service_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: task_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks tasks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_delete ON public.tasks FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = tasks.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: tasks tasks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_insert ON public.tasks FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = tasks.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: tasks tasks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_select ON public.tasks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = tasks.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: tasks tasks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_update ON public.tasks FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.boutique_members
  WHERE ((boutique_members.boutique_id = tasks.boutique_id) AND (boutique_members.user_id = auth.uid())))));


--
-- Name: vendors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

--
-- Name: wedding_budget_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wedding_budget_items ENABLE ROW LEVEL SECURITY;

--
-- Name: wedding_checklist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wedding_checklist_items ENABLE ROW LEVEL SECURITY;

--
-- Name: wedding_gifts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wedding_gifts ENABLE ROW LEVEL SECURITY;

--
-- Name: wedding_guests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wedding_guests ENABLE ROW LEVEL SECURITY;

--
-- Name: wedding_legal_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wedding_legal_items ENABLE ROW LEVEL SECURITY;

--
-- Name: wedding_music; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wedding_music ENABLE ROW LEVEL SECURITY;

--
-- Name: wedding_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wedding_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: wedding_run_of_show; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wedding_run_of_show ENABLE ROW LEVEL SECURITY;

--
-- Name: wedding_vendor_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wedding_vendor_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: wedding_vendors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wedding_vendors ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

