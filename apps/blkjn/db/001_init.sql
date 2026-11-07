CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  public_ref text NOT NULL UNIQUE,
  environment text NOT NULL CHECK (environment IN ('test', 'live')),
  access_token_hash text NOT NULL,
  buyer_email text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'PHP',
  total_centavos integer NOT NULL CHECK (total_centavos >= 0),
  catalogue_version text NOT NULL,
  status text NOT NULL,
  payment_method text CHECK (payment_method IN ('gcash', 'gotyme')),
  quote_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  test_only boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS order_lines (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders (id),
  sku text NOT NULL,
  title_snapshot text NOT NULL,
  unit_centavos integer NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  line_centavos integer NOT NULL
);

CREATE TABLE IF NOT EXISTS receipt_submissions (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders (id),
  idempotency_key text NOT NULL,
  object_key text,
  content_sha256 text,
  content_type text,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (order_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS payment_reference_claims (
  canonical_key text PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders (id),
  claimed_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS order_events (
  id uuid PRIMARY KEY,
  order_id uuid REFERENCES orders (id),
  event_type text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id uuid PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL,
  lease_until timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  fence_token text,
  fence_generation integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS template_requests (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS fulfillments (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders (id),
  receipt_version integer NOT NULL,
  status text NOT NULL,
  provider_message_id text,
  created_at timestamptz NOT NULL,
  UNIQUE (order_id, receipt_version)
);

CREATE TABLE IF NOT EXISTS download_grants (
  id uuid PRIMARY KEY,
  fulfillment_id uuid NOT NULL REFERENCES fulfillments (id),
  order_id uuid NOT NULL,
  sku text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  remaining_count integer NOT NULL CHECK (remaining_count >= 0),
  created_at timestamptz NOT NULL
);

ALTER TABLE outbox ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS fence_token text;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS fence_generation integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS send_reservations (
  id uuid PRIMARY KEY,
  event_id text NOT NULL,
  action text NOT NULL,
  fence_token text NOT NULL,
  state text NOT NULL,
  provider_message_id text,
  report_key text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (event_id, action)
);
