-- Sequence 3 of 3. Read-only checks. Run after 001_init.sql and 002_supabase_hardening.sql.
-- Raises an exception when the server-only schema is incomplete.
-- Does not change search_path, grants, or rows.

DO $$
DECLARE
  missing text;
  tables text[] := ARRAY[
    'schema_migrations',
    'orders',
    'order_lines',
    'receipt_submissions',
    'payment_reference_claims',
    'order_events',
    'outbox',
    'template_requests',
    'fulfillments',
    'download_grants',
    'send_reservations'
  ];
  indexes text[] := ARRAY[
    'schema_migrations_pkey',
    'orders_pkey',
    'orders_public_ref_key',
    'order_lines_pkey',
    'receipt_submissions_pkey',
    'receipt_submissions_order_id_idempotency_key_key',
    'payment_reference_claims_pkey',
    'order_events_pkey',
    'order_events_idempotency_key_key',
    'outbox_pkey',
    'outbox_event_id_key',
    'template_requests_pkey',
    'fulfillments_pkey',
    'fulfillments_order_id_receipt_version_key',
    'download_grants_pkey',
    'download_grants_token_hash_key',
    'send_reservations_pkey',
    'send_reservations_event_id_action_key'
  ];
  constraints text[] := ARRAY[
    'orders_environment_check',
    'orders_payment_method_check',
    'orders_total_centavos_check',
    'order_lines_quantity_check',
    'order_lines_order_id_fkey',
    'receipt_submissions_order_id_fkey',
    'payment_reference_claims_order_id_fkey',
    'order_events_order_id_fkey',
    'fulfillments_order_id_fkey',
    'download_grants_fulfillment_id_fkey',
    'download_grants_remaining_count_check'
  ];
  api_roles text[] := ARRAY['anon', 'authenticated', 'service_role'];
  privileges text[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'];
  tbl text;
  idx text;
  con text;
  api_role text;
  privilege text;
BEGIN
  IF current_setting('search_path') NOT ILIKE '%public%' THEN
    RAISE EXCEPTION 'search_path % does not include public', current_setting('search_path');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'buyer_payment_claimed_at') THEN
    RAISE EXCEPTION 'orders.buyer_payment_claimed_at must not exist';
  END IF;

  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tbl AND c.relkind = 'r'
    ) THEN
      RAISE EXCEPTION 'missing table public.%', tbl;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tbl AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is off for public.%', tbl;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tbl AND c.relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'FORCE RLS is on for public.%; the table-owner runtime would be denied', tbl;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
        AND roles && ARRAY['anon', 'authenticated', 'service_role', 'public']::name[]
    ) THEN
      RAISE EXCEPTION 'public.% has a policy for an API role', tbl;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'outbox'
      AND column_name IN ('fence_token', 'fence_generation', 'lease_until', 'attempt_count')
    HAVING count(*) = 4
  ) THEN
    RAISE EXCEPTION 'outbox is missing lease or fence columns';
  END IF;

  FOREACH idx IN ARRAY indexes LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = idx) THEN
      RAISE EXCEPTION 'missing index %', idx;
    END IF;
  END LOOP;

  FOREACH con IN ARRAY constraints LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND c.conname = con
    ) THEN
      RAISE EXCEPTION 'missing constraint %', con;
    END IF;
  END LOOP;

  FOREACH api_role IN ARRAY api_roles LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      RAISE EXCEPTION 'missing role %', api_role;
    END IF;
    IF NOT has_schema_privilege(api_role, 'public', 'USAGE') THEN
      RAISE EXCEPTION '% cannot see schema public', api_role;
    END IF;
    IF has_schema_privilege(api_role, 'public', 'CREATE') THEN
      RAISE EXCEPTION '% can create objects in schema public', api_role;
    END IF;
    FOREACH tbl IN ARRAY tables LOOP
      FOREACH privilege IN ARRAY privileges LOOP
        IF has_table_privilege(api_role, format('public.%I', tbl), privilege) THEN
          RAISE EXCEPTION '% still has % on public.%', api_role, privilege, tbl;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  SELECT string_agg(a.privilege_type, ', ')
  INTO missing
  FROM pg_default_acl d
  CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole = CURRENT_USER::regrole
    AND d.defaclnamespace = 'public'::regnamespace
    AND d.defaclobjtype = 'r'
    AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
    AND a.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE');
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'future tables created by % still grant API roles: %', CURRENT_USER, missing;
  END IF;
END $$;
