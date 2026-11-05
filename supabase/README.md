# NMMPC Supabase database

This directory contains the reproducible database configuration for the mobile app.

## Contents

- `config.toml` — local Supabase services configuration.
- `migrations/20261101000000_initial_schema.sql` — the initial database schema.
- `migrations/20261101010000_authentication_authorization.sql` — employee/admin authorization helpers and RLS policies.
- `tests/authorization.test.sql` — structural RLS, policy coverage, and anonymous-access checks.
- `seed.sql` — a development residential tariff and tier set.

Additional applied migrations define atomic meter replacement, historical-meter access, and the complete versioned billing-rule model. The calculation order and approval requirements are documented in `Project setup/BILLING_RULES.md`. The development tariff is sample data only and is not an approved production tariff.

## Local validation

Supabase local development requires Docker Desktop or another supported Docker-compatible runtime.

```powershell
npm.cmd run supabase:start
npm.cmd run supabase:reset
npm.cmd run supabase:lint
npm.cmd run supabase:test
npm.cmd run supabase:types
```

`supabase:reset` recreates the local database and applies every migration plus the seed file. Do not use a linked reset against a non-disposable hosted project.

## Hosted development project

Rotate any exposed secret key before doing hosted work. Authenticate the CLI with a Supabase personal access token, link the development project, review the migration, and then push it:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npx.cmd supabase migration list
npx.cmd supabase db push
npx.cmd supabase gen types typescript --linked --schema public > src\types\database.types.ts
```

Never add a database password, personal access token, secret key, or service-role key to the mobile app or a committed file.

## Security state

The initial migration enables Row Level Security on every application table and revokes anonymous table access. The authorization migration adds active-account checks, administrator permissions, employee assignment restrictions, and owner-only printer settings. Authorization roles are stored in `public.profiles`; never use user-editable metadata as an authorization source.

## Auth dashboard setup

1. The linked project configuration includes `nmmpc://**` in the allowed redirect URLs. Password recovery should be tested in a development build because Expo Go does not provide a stable production-style scheme.
2. Create employee users in **Authentication → Users** with their work email and a temporary password. The signup trigger creates the corresponding `profiles` row.
3. Assign an employee code and keep the default employee role:

   ```sql
   update public.profiles
   set employee_code = 'EMP-0001', full_name = 'Employee Name'
   where id = 'AUTH_USER_UUID';
   ```

4. Bootstrap an administrator only through the SQL Editor or another trusted server-side process:

   ```sql
   update public.profiles
   set role = 'administrator', employee_code = 'ADM-0001', full_name = 'Administrator Name'
   where id = 'AUTH_USER_UUID';
   ```

5. Disable an account without deleting its billing history:

   ```sql
   update public.profiles
   set is_active = false
   where id = 'AUTH_USER_UUID';
   ```

The mobile app cannot promote users or bypass RLS. A disabled profile loses application-data access and is signed out when its account status is checked.

## Hosted backend acceptance tests

Create dedicated, confirmed employee and administrator test users using the steps above. Copy `.env.test.example` to `.env.test`, replace every example address and `replace-...` password with those real test-user credentials, and run:

```powershell
Copy-Item .env.test.example .env.test
npm.cmd run backend:test
```

The runner signs in through the public client, verifies profile roles, creates two temporary customers as the administrator, confirms the employee sees only the assigned customer, checks that employee tariff writes are denied, verifies signed-out access is rejected, and removes its temporary records. It never needs a secret or service-role key. `.env.test` is ignored by Git.
