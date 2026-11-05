# Phase 7 Offline Acceptance

Run these checks with an Android development build and a real test account that already has assigned customers and approved tariffs cached. Expo Go does not provide the native offline database used by this workflow.

## Install and open the development build

Do not scan the Metro QR code with Expo Go. On Windows, build the Android development APK in Expo's cloud:

```powershell
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest init --account <your-expo-account>
npx.cmd eas-cli@latest build --platform android --profile development
```

Run `init` only once. It creates or links the Expo project and writes `extra.eas.projectId` to `app.json`. If `whoami` reports that the current credentials are limited to Viewer, replace the limited grant using Expo's device/browser login. Sign in with the same Google, GitHub, Apple, SSO, passkey, or password method used on expo.dev, and grant Developer-or-higher access to the `xyrusfelix` account:

```powershell
npx.cmd eas-cli@latest logout
npx.cmd eas-cli@latest login --device
npx.cmd eas-cli@latest whoami
```

The `--no-browser` login requires a valid Expo username/password and is not suitable for an OAuth-only account. If a password should exist but is unknown, reset it at `https://expo.dev/reset-password`. Do not continue until `whoami` no longer says `limited to Viewer`. If device login still grants only Viewer access, create a personal access token at `https://expo.dev/settings/access-tokens` with project-creation access, keep it private, set it only in the current PowerShell session, and initialize non-interactively:

```powershell
$env:EXPO_TOKEN = '<private-token>'
npx.cmd eas-cli@latest init --account <your-expo-account> --force --non-interactive
Remove-Item Env:EXPO_TOKEN
```

A Git remote is optional for this cloud build; the local repository only needs a valid branch and commit.

Download and install the resulting APK on the Android phone. Then start Metro from this project:

```powershell
npm.cmd run start:dev
```

Open the installed **NMMPC** development app and connect it to that Metro server. If Android Studio and USB debugging are configured locally, `npx.cmd expo run:android --device` is an alternative to the cloud build.

1. Open an assigned customer online once, then enable airplane mode. Capture a reading, save the provisional statement, and record screenshot evidence.
2. Close and reopen the app. Confirm the provisional statement and pending synchronization count remain.
3. Restore connectivity and tap **Retry**. Confirm the pending count clears and the provisional statement becomes a saved server invoice.
4. Trigger Retry repeatedly. Confirm one reading and one invoice exist for the client operation IDs.
5. Create a competing server invoice for the same customer and period, then reconnect. Confirm the local payload is preserved as a review-required failure and no duplicate is created.
6. Save another offline reading, force-stop the app during synchronization, reopen it, and confirm the interrupted item returns to pending and completes on retry.
7. Interrupt a photo upload, then reconnect. Confirm the same private object path is reused and the queue completes without creating a second object.

Create the local evidence manifest first:

```powershell
npm.cmd run phase7:setup
```

Then fill in the device, timestamp, result, and evidence path for every scenario and run:

```powershell
npm.cmd run phase7:acceptance
```

Rows with `passed: false` are reported as `PENDING`. For a completed row, use an ISO timestamp such as `2026-11-04T14:30:00+08:00`, identify the development-build device, and provide the relative path to its screenshot, video, log, or database evidence. The checklist must remain unchecked until this command passes with real physical-device evidence.
