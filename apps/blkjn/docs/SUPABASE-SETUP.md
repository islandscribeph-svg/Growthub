# BLKJN Supabase setup

Apply this to the empty BLKJN project `hzmwjbqcplmbsohfeapn` in the Islandscribe org `hoqniycazoiqjquvmgpa` (Tokyo, `ap-northeast-1`). Do not run it against the Growthub database. This does not turn on purchase, request intake, or fulfillment, and it does not create a storage bucket or make downloads work.

The app reads and writes with the `pg` driver and unqualified table names. The tables stay in `public`. Nothing in these scripts changes `search_path`. The runtime role is the table owner, `postgres`, which bypasses row level security. `anon`, `authenticated`, and `service_role` get no privileges and no policies, so the Data API cannot read orders or receipt metadata.

## Sequence

Run these as `postgres` in the Supabase SQL editor, or over the direct connection. Run them in this order. Each file can be run again. None of them drop tables or delete rows.

1. `apps/blkjn/db/001_init.sql`
2. `apps/blkjn/db/002_supabase_hardening.sql`
3. `apps/blkjn/db/003_verify.sql`

`003_verify.sql` only checks. If it finishes without an error, the tables, unique indexes, checks, foreign keys, outbox fence columns, send reservations, RLS, and API-role grant denials are in place. It does not mean the site is ready to sell or deliver files.

## Runtime connection

The Next.js server is serverless. Use the shared pooler in transaction mode. Copy the host from the dashboard Connect dialog. Do not build the pooler host from the region name. The username for that pooler is `postgres.hzmwjbqcplmbsohfeapn`. The direct host, for the SQL above only, is `db.hzmwjbqcplmbsohfeapn.supabase.co`.

One secret is required:

`BLKJN_DATABASE_URL`

```text
postgresql://postgres.hzmwjbqcplmbsohfeapn:[PASSWORD]@[POOLER-HOST]:6543/postgres?sslmode=verify-full
```

Percent-encode reserved characters in the password. Do not commit the password. Do not set `sslmode=no-verify`, and do not set `uselibpqcompat=true` together with `sslmode=require` unless `sslrootcert` points at the project root certificate from Database settings. Those forms turn certificate checks off, and the server rejects them. `sslmode=verify-full` encrypts the connection and checks the server certificate. If the platform trust store does not accept the Supabase certificate, add `&sslrootcert=/path/to/prod-ca.crt` from the dashboard. Do not disable verification.

The server keeps one pool connection when the URL uses port `6543`. Queries stay unnamed parameterized queries, which is the node-postgres form that transaction pooling can run. Do not add a Supabase client, a publishable key, or a `service_role` key to the app. Receipt bytes still need the separate S3 settings. Those are not part of this database URL.

`BLKJN_PURCHASE_LIVE`, `BLKJN_REQUEST_INTAKE_LIVE`, and `BLKJN_FULFILLMENT_LIVE` stay unset or `false`.
