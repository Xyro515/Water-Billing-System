# Running NMMPC locally

This workspace contains two applications:

- `water-meter-billing` — Expo SDK 58 mobile application.
- `water-meter-admin` — sibling Next.js 16 administration dashboard.

Use two PowerShell terminals when running both applications together.

## Prerequisites

- Node.js 22.13 or newer for Expo SDK 58. Next.js 16 requires Node.js 20.9 or newer, so Node 22 satisfies both projects.
- npm, which is the package manager currently represented by both lockfiles.
- A Supabase project with the repository migrations applied.
- For full mobile functionality: an Android development build installed on a phone or emulator.

Never put a Supabase secret or service-role key in either application. Both clients use the public project URL and publishable key, with access controlled by authentication and Row Level Security.

## First-time installation

Install the mobile dependencies:

```powershell
Set-Location C:\Xyrus\Apps\water-meter-billing
npm.cmd install
```

Install the admin dependencies:

```powershell
Set-Location C:\Xyrus\Apps\water-meter-admin
npm.cmd install
```

## Environment variables

### Mobile application

The mobile project reads `water-meter-billing\.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

If the file does not exist, create it from `.env.example`, then replace the placeholders:

```powershell
Set-Location C:\Xyrus\Apps\water-meter-billing
Copy-Item .env.example .env
```

### Admin dashboard

The admin project reads `water-meter-admin\.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

If the file does not exist, create it from the template and use the same public Supabase values as the mobile app:

```powershell
Set-Location C:\Xyrus\Apps\water-meter-admin
Copy-Item .env.example .env.local
```

Restart the relevant development server after changing environment variables.

## Start the mobile application

### Recommended: installed development build

The normal start command targets the Expo development client:

```powershell
Set-Location C:\Xyrus\Apps\water-meter-billing
npm.cmd start
```

Open the installed NMMPC development build and select the detected server, or scan the QR code. The computer and phone should normally be on the same network.

Use a development build for:

- Native Bluetooth discovery, pairing, connection, and receipt printing.
- Phase 7 SQLite caching and synchronization.
- Any feature backed by a native library not bundled with Expo Go.

After adding or changing native dependencies or config plugins, create and reinstall a new development build:

```powershell
npx.cmd eas-cli@latest build --profile development --platform android
```

### Expo Go compatibility mode

Expo Go can run the online-only compatibility path and virtual-printer bridge, but it cannot load this project's native Bluetooth printer modules:

```powershell
Set-Location C:\Xyrus\Apps\water-meter-billing
npm.cmd run start:go
```

Scan the terminal QR code with Expo Go. If LAN discovery fails, use the slower tunnel mode:

```powershell
npm.cmd run start:tunnel
```

### Mobile web build

```powershell
Set-Location C:\Xyrus\Apps\water-meter-billing
npm.cmd run web
```

## Start the admin dashboard

In a second terminal:

```powershell
Set-Location C:\Xyrus\Apps\water-meter-admin
npm.cmd run dev
```

Open <http://localhost:3000>. Sign in with an active Supabase user whose protected `public.profiles.role` is `administrator`. Employee accounts are redirected to the unauthorized page and remain restricted by database RLS.

To test the production server locally:

```powershell
npm.cmd run build
npm.cmd start
```

## Run both applications together

Terminal 1:

```powershell
Set-Location C:\Xyrus\Apps\water-meter-billing
npm.cmd start
```

Terminal 2:

```powershell
Set-Location C:\Xyrus\Apps\water-meter-admin
npm.cmd run dev
```

Both applications can use the same Supabase development project and public client configuration.

## Virtual receipt printer

Start the Windows virtual-printer bridge in a separate terminal before printing from Expo Go:

```powershell
Set-Location C:\Xyrus\Apps\water-meter-billing
npm.cmd run printer:virtual
```

The phone must be able to reach the computer over the LAN. Windows Firewall may prompt for network access the first time the bridge starts.

## Database migrations

Review pending remote migrations without changing the database:

```powershell
Set-Location C:\Xyrus\Apps\water-meter-billing
npx.cmd supabase db push --dry-run --remote
```

After confirming the target project and every pending migration, apply them with:

```powershell
npx.cmd supabase db push --remote
```

The dashboard spreadsheet importer requires the `record_admin_audit` function from `supabase\migrations\20261104010000_admin_dashboard_audit.sql`.

## Validation

Validate the mobile project:

```powershell
Set-Location C:\Xyrus\Apps\water-meter-billing
npx.cmd expo lint
npx.cmd tsc --noEmit
npx.cmd expo-doctor
```

The known Expo Doctor exception is the React Native Directory metadata/New Architecture warning for the native Bluetooth and receipt-printer packages.

Validate the admin project:

```powershell
Set-Location C:\Xyrus\Apps\water-meter-admin
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

## Troubleshooting

### The phone cannot find the Expo server

- Confirm the computer and phone are on the same Wi-Fi network.
- Allow Node.js through Windows Firewall on private networks.
- Disable VPN isolation temporarily if appropriate.
- Try `npm.cmd run start:tunnel` for Expo Go.
- For a development build, reopen the launcher and scan the current QR code.

### The admin dashboard reports missing Supabase variables

- Confirm `.env.local` is in `C:\Xyrus\Apps\water-meter-admin`, not inside `src`.
- Confirm both variable names begin with `NEXT_PUBLIC_`.
- Restart `npm.cmd run dev` after editing the file.

### Sign-in succeeds but the admin dashboard denies access

Confirm the authenticated user's `public.profiles` record is active, not archived, and has `role = 'administrator'`. Do not grant access through client-editable user metadata.

### Bluetooth controls are unavailable

Expo Go does not contain the native Bluetooth modules used by this project. Install and open the development build, then start Metro with `npm.cmd start`.

