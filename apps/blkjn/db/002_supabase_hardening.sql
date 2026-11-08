-- Sequence 2 of 3. Run after 001_init.sql. Safe to run again.
-- Does not DROP, TRUNCATE, or DELETE. Does not change search_path.
-- Tables stay in public so the server's unqualified SQL keeps resolving
-- through the role's default search_path, which includes public.
--
-- Run this as the migration role that owns the tables. On Supabase that
-- role is postgres. The runtime connection uses that same role, so it
-- bypasses RLS as the owner. anon, authenticated, and service_role receive
-- no privileges. RLS is enabled and no policy is created for them.

DO $$
DECLARE
  tbl text;
  api_role text;
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
  api_roles text[] := ARRAY['anon', 'authenticated', 'service_role'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', tbl);
    FOREACH api_role IN ARRAY api_roles LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', tbl, api_role);
      END IF;
    END LOOP;
  END LOOP;

  FOREACH api_role IN ARRAY api_roles LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', api_role);
      EXECUTE format('REVOKE CREATE ON SCHEMA public FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', api_role);
    END IF;
  END LOOP;
END $$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

INSERT INTO schema_migrations (id) VALUES ('002_supabase_hardening') ON CONFLICT (id) DO NOTHING;
