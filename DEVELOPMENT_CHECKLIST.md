# NMMPC — Complete Development Checklist

Last updated: November 5, 2026

Use this file as the project’s living checklist. Check an item only after it has been implemented and tested. Items marked as complete reflect the work currently present in this repository.

## Overall progress

- [x] Phase 0 — Development environment and project foundation
- [ ] Phase 1 — Mobile UI and navigation (implementation complete; physical-device QA pending)
- [ ] Phase 2 — Supabase backend
- [ ] Phase 3 — Customer and meter management
- [ ] Phase 4 — Billing engine
- [ ] Phase 5 — Bluetooth thermal printing
- [ ] Phase 6 — Automatic water meter scanning
- [ ] Phase 7 — Offline support and synchronization
- [ ] Phase 8 — Admin web dashboard
- [ ] Phase 9 — Security and quality assurance
- [ ] Phase 10 — Deployment and operations

---

## Phase 0 — Development environment

### Project setup

- [x] Create Expo and React Native TypeScript project
- [x] Configure Expo SDK 58
- [x] Enable TypeScript strict mode
- [x] Install Expo Router
- [x] Move application routes into `src/app/`
- [x] Configure `expo-router/entry`
- [x] Add the Expo Router config plugin
- [x] Enable typed routes
- [x] Configure the `nmmpc` URL scheme
- [x] Install Expo Camera
- [x] Install Expo SQLite
- [x] Configure SQLite WAL and foreign-key PRAGMAs outside migration transactions
- [x] Use web-compatible SQLite transactions while retaining exclusive transactions on native platforms
- [x] Allow offline-database initialization to retry after a failed migration
- [x] Install Expo development client
- [x] Install React Native safe-area support
- [x] Configure Expo-compatible ESLint
- [x] Add lint and typecheck scripts
- [x] Add Expo Go startup script
- [x] Add Expo Go tunnel script
- [x] Add development-client startup script
- [x] Align installed package versions with Expo SDK 58 using `npx.cmd expo install --fix`
- [x] Add a unified local run guide for the mobile app and admin dashboard at `Project setup/RUN.md`

### Validation

- [x] Run `npx.cmd expo lint`
- [x] Run `npx.cmd tsc --noEmit`
- [x] Run `npx.cmd expo-doctor`
- [ ] Pass all 20 Expo Doctor checks (currently 19/20; the Bluetooth Classic dependency is not listed as New Architecture-tested)
- [x] Generate an Android production bundle successfully
- [x] Generate a web production bundle successfully
- [ ] Open the application in Expo Go on a physical Android phone
- [ ] Confirm Fast Refresh works on the phone
- [x] Initialize or verify the Git repository
- [x] Create the first project commit

### Useful commands

```powershell
# Start using the installed development build (recommended for this project)
npm.cmd start

# Start in Expo Go mode for QR/camera-only testing
npm.cmd run start:go

# Use this if the phone cannot connect over the local network
npm.cmd run start:tunnel

# Equivalent explicit development-build command
npm.cmd run start:dev

# Validate the project
npx.cmd expo lint
npx.cmd tsc --noEmit
npx.cmd expo-doctor
```

---

## Phase 1 — Mobile UI and navigation

Implementation status: **Complete.** Android, iOS, and web production bundles passed on November 2, 2026. Final sign-off is still waiting for the required physical Android tests and comparison with the final Figma file. Items explicitly deferred to later phases do not block the Phase 1 implementation milestone.

### Design system and shared UI

- [x] Create the NMMPC color palette
- [x] Create spacing and corner-radius tokens
- [x] Create the NMMPC brand component
- [x] Create reusable screen headers
- [x] Create reusable cards
- [x] Create primary and secondary buttons
- [x] Create customer status badges
- [x] Create reusable dashboard metrics
- [x] Create bottom navigation
- [x] Add direction-aware bottom-navigation transitions and active-widget feedback
- [x] Add consistent cross-platform press transitions to interactive buttons, cards, tabs, and selectors
- [x] Respect the Android and iOS Reduce Motion accessibility preference for button transitions
- [x] Add safe-area handling
- [x] Add consistent loading-ready screen layouts
- [x] Replace temporary text symbols with final icon assets
- [ ] Confirm colors and typography against the final Figma design
- [x] Confirm a light-only theme for Phase 1 (dark mode can be added later if required)
- [x] Add accessibility labels to every interactive control
- [ ] Test large text and screen-reader behavior

### Employee login

- [x] Create employee login screen
- [x] Add work email input (replaced the original sample employee ID input)
- [x] Add password input
- [x] Add show and hide password control
- [x] Add forgot-password placeholder
- [x] Replace sample credentials with authorized employee accounts
- [x] Navigate from login to dashboard
- [x] Add input validation messages
- [x] Add loading and failed-login states
- [x] Connect login to Supabase Auth
- [ ] Deferred to Phase 9: Store and restore authenticated sessions in encrypted secure storage
- [x] Add production session logout

### Employee dashboard

- [x] Create dashboard screen
- [x] Show employee greeting and date
- [x] Show assigned route
- [x] Show route completion percentage
- [x] Show completed and remaining readings
- [x] Show daily billing total
- [x] Show upcoming customers
- [x] Add new-reading shortcut
- [x] Load employee and route information from the Phase 1 sample data source
- [x] Add synchronization status indicator
- [x] Add offline-mode indicator
- [x] Add notification behavior

### Customer list and details

- [x] Create sample customer data
- [x] Create customer list screen
- [x] Add customer search
- [x] Search by name, account number, or meter number
- [x] Display billing status badges
- [x] Create visual filter controls
- [x] Create customer details screen
- [x] Show customer address and account number
- [x] Show assigned meter information
- [x] Show previous reading
- [x] Show outstanding balance
- [x] Show recent reading history
- [x] Link customer details to reading entry
- [x] Make customer filters functional
- [x] Add empty search results state
- [x] Add loading and error states
- [x] Replace customer list and detail sample data with authorized Supabase records

### Meter reading workflow

- [x] Protect signed-in and signed-out route groups with explicit redirect destinations
- [x] Refresh dashboard, customer list, and customer details when they regain focus
- [x] Give header Back actions a safe destination when no navigation history exists
- [x] Exclude inactive, unmetered, and already-read customers from the next-reading queue
- [x] Block new readings for inactive accounts, missing active meters, and already-covered billing dates
- [x] Generate billing dates from the device's local calendar date instead of UTC
- [x] Add a consistent three-step Reading, Review, and Invoice progress indicator
- [x] Protect reading drafts when the header or Android hardware Back action is used
- [x] Require photo evidence and explicit confirmation for exceptional meter conditions
- [x] End a saved-invoice workflow at the customer queue instead of reopening stale confirmation screens
- [x] Create manual meter-reading screen
- [x] Show meter and customer details
- [x] Show previous reading
- [x] Add numeric current-reading input
- [x] Calculate consumption automatically
- [x] Prevent readings below the previous reading
- [x] Show normal-usage or high-usage feedback
- [x] Add identified customer-and-meter photo capture action
- [x] Navigate to invoice preview
- [x] Add a dedicated reading-confirmation screen
- [x] Add explicit high-usage confirmation
- [x] Add meter rollover handling
- [x] Add replaced-meter handling
- [x] Add unreadable-meter handling
- [x] Save reading drafts locally with Expo SQLite key-value storage
- [x] Confirm GPS capture is not required for the Phase 1 workflow
- [x] Record employee and timestamp metadata

### Invoice preview

- [x] Create invoice preview screen
- [x] Show customer and account information
- [x] Show previous and current readings
- [x] Calculate consumption
- [x] Calculate charges with the approved effective member or non-member tariff
- [x] Show itemized base, excess, balance, discount, tax, and penalty charges when applicable
- [x] Calculate total amount due
- [x] Show billing period and due date
- [x] Clearly label unsaved previews as non-final bills
- [x] Add receipt printing workflow with clearly labeled preview output and audited saved-invoice printing
- [x] Use the production billing engine
- [x] Generate unique invoice numbers when the invoice is persisted
- [x] Freeze applied tariff details for auditing
- [x] Save provisional invoices and their reading payloads to local storage atomically
- [ ] Deferred to Phase 2/4: Save invoices to Supabase
- [x] Add previous balance and payment calculations
- [x] Show current bill and previous balance as separate invoice-summary amounts
- [x] Print current bill, previous balance, and total amount due on 58 mm and 80 mm receipts
- [x] Add a direct Save and print invoice action after reading confirmation
- [x] Add invoice status handling for persisted invoices

### Printer settings UI

- [x] Create printer settings screen
- [x] Show disconnected-printer state
- [x] Add nearby-printer placeholder action
- [x] Add saved-device empty state
- [x] Add 58 mm and 80 mm paper selection
- [x] Add automatic-print preference
- [x] Add functional 58 mm and 80 mm test-print control (development build and printer required)
- [x] Explain development-build requirement
- [x] Connect printer controls to native Bluetooth functionality (development build required)
- [x] Persist printer preferences locally

### Phase 1 acceptance tests

- [ ] Test every screen on a physical Android phone
- [ ] Test navigation through the complete sample workflow
- [ ] Test Android hardware back behavior
- [ ] Test keyboard behavior on small screens
- [ ] Test the login form with an external keyboard
- [ ] Test customer search with partial and mixed-case values
- [ ] Test reading values equal to and below the previous reading
- [ ] Test long customer names and addresses
- [ ] Verify layouts at common Android screen sizes
- [ ] Review the completed interface against Figma

Phase 1 is complete when every screen is navigable with sample data and the workflow has been tested on a physical Android phone.

---

## Phase 2 — Supabase backend

### Project and environment

The development project, Data API, linked CLI, and typed client are verified. Separate preview/production Supabase projects and EAS environment values remain future deployment work.

- [x] Create development Supabase project
- [ ] Create staging and production projects when needed
- [x] Add public Supabase URL environment variable
- [x] Add public publishable key environment variable
- [x] Confirm no secret or service-role credentials exist in the mobile app
- [x] Add typed Supabase client
- [x] Configure development, preview, and production EAS build profiles
- [x] Enable and verify the hosted Supabase Data API
- [x] Link the Supabase CLI to the hosted development project

### Database schema

The complete schema and authorization migration are applied to the hosted development project. The committed TypeScript definitions were regenerated from that hosted schema.

- [x] Define `profiles` table in the initial migration
- [x] Define `customers` table in the initial migration
- [x] Define `meters` table in the initial migration
- [x] Define `meter_assignments` table in the initial migration
- [x] Define `meter_readings` table in the initial migration
- [x] Define `tariffs` table in the initial migration
- [x] Define `tariff_tiers` table in the initial migration
- [x] Define `invoices` table in the initial migration
- [x] Define `invoice_items` table in the initial migration
- [x] Define `payments` table in the initial migration
- [x] Define `printer_devices` table in the initial migration
- [x] Define `audit_logs` table in the initial migration
- [x] Add primary and foreign keys
- [x] Add uniqueness and data-integrity constraints
- [x] Add indexes for mobile search and synchronization
- [x] Add created and updated timestamps with update triggers
- [x] Add soft-delete or archival rules where appropriate
- [x] Add schema-aligned TypeScript database types
- [x] Apply the initial migration to the hosted development project
- [x] Apply the authentication and authorization migration to the hosted development project
- [ ] Run the migration through `supabase db reset` locally
- [x] Regenerate TypeScript types from the applied hosted database schema

### Authentication and authorization

The application auth provider and authorization migration are deployed. The `nmmpc://**` recovery redirect is applied without changing the project's existing email-confirmation or TOTP settings. Dedicated employee/admin users are still required for live acceptance testing.

- [x] Configure employee email/password authentication in the mobile app
- [x] Configure administrator authentication using the protected profile role
- [x] Define employee and administrator database roles
- [x] Enable Row Level Security on all private tables in the initial migration
- [x] Restrict employees to assigned customer accounts
- [x] Restrict tariff management to administrators
- [x] Restrict employee management to administrators
- [x] Add secure password-reset flow with mobile deep linking
- [x] Apply the `nmmpc://**` password-recovery redirect to hosted Auth
- [x] Add account-disable behavior and fail-closed session checks
- [x] Add automated policy-coverage and anonymous-access tests
- [ ] Test every RLS policy

### Backend acceptance tests

The hosted acceptance runner is available through `npm.cmd run backend:test`. It uses dedicated employee/admin credentials from the ignored `.env.test` file and deletes its temporary customer records after the run.

Hosted acceptance run passed on November 2, 2026. The runner verifies explicit sign-out and rejected restoration of a revoked token pair; Expo Router protected routes remove private history and return a cleared session to login.

- [x] Add hosted acceptance-test runner without secret/service-role credentials
- [x] Employee can sign in securely
- [x] Employee sees only assigned customers
- [x] Administrator can manage authorized records
- [x] Unauthorized reads and writes are rejected
- [x] Signed-out sessions lose backend access
- [x] Expired sessions return to login safely
- [x] Scope application sign-out and invalid-session cleanup to the current device instead of revoking other device sessions
- [x] Preserve the local session during transient auto-refresh network or service failures
- [x] Detect revoked, missing, and unauthorized refresh sessions and return them safely to login
- [x] Add automated terminal-versus-transient session error tests
- [x] Isolate development/production Supabase Auth from Expo SQLite with the recommended React Native AsyncStorage session adapter
- [x] Use an Expo Go in-memory Auth adapter to avoid its closed native AsyncStorage resource during development reloads
- [x] Dispose the Supabase client and AppState refresh listener before Metro replaces the module
- [x] Detect and reopen offline SQLite handles invalidated by Fast Refresh
- [x] Remove Expo SQLite key-value storage from all Expo Go session, draft, and printer-preference paths
- [x] Disable SQLite DevTools registration for the app-managed offline connection
- [x] Add an Expo Go online-only compatibility mode that bypasses Phase 7 SQLite and Expo Network native resources
- [x] Lazy-load SQLite and Expo Network only in development builds so the Expo Go member list cannot initialize unsupported offline resources
- [ ] Verify Phase 7 SQLite caching and synchronization in the development build (deferred; intentionally disabled in Expo Go)

---

## Phase 3 — Customer and meter management

### Customer management

- [x] Load customer assignments from Supabase
- [x] Add server-side and local search
- [x] Add customer account status
- [x] Add customer contact information
- [x] Add customer billing address
- [x] Add customer notes
- [x] Add pagination or virtualized list behavior

### Meter management

- [x] Load assigned meter details
- [x] Store meter serial and identification numbers
- [x] Store installation and replacement dates
- [x] Show active and inactive meters
- [x] Add meter assignment history
- [x] Add meter replacement workflow
- [x] Add QR-code generation for meter IDs
- [x] Add QR-code scanning
- [x] Confirm scanned QR code matches customer assignment
- [x] Show complete reading history

### Phase 3 acceptance tests

Hosted backend acceptance and QR routing tests passed on November 2, 2026. The remaining two items require scanning a real QR label and observing the resulting screen on a physical Android phone.

Physical-device verification (pending): install an SDK 58-compatible Expo Go build or the current SDK 58 development build, sign in as the assigned employee, open **Customers > Scan meter QR**, scan the QR shown on that customer's details screen or printed meter label, and confirm that the app opens the same customer with the **QR scan verified** message and matching active meter number. Repeat with an unassigned meter and confirm that access is rejected. The default `npm start` command now targets the development client; use `npm run start:go` only with SDK 58-compatible Expo Go.

- [x] Employee can search for an assigned customer
- [ ] Employee can scan a meter QR code
- [ ] Correct customer and meter record opens
- [x] Previous reading and billing period are correct
- [x] Unassigned customers remain inaccessible
- [x] Scanned QR value resolves to the assigned customer and active meter in hosted acceptance tests
- [x] QR navigation preserves both the matched customer ID and scanned meter ID
- [x] Customer details reject a scanned meter that is no longer the active assignment
- [x] Customer details visibly confirm the scanned active meter and matched customer

---

## Phase 4 — Billing engine

### Billing rules

- [x] Define versioned tariffs
- [x] Define tariff effective dates
- [x] Define tiered consumption rates
- [x] Define fixed service charges
- [x] Define taxes if applicable
- [x] Define discounts and subsidies
- [x] Define penalties and previous balances
- [x] Define due-date rules
- [x] Define minimum charge rules
- [x] Define meter rollover behavior
- [x] Define rounding rules
- [x] Define member and non-member customer classifications
- [x] Classify demo account `DEMO-MEMBER-0002` as a non-member in the linked development database
- [x] Define ₱150 member and ₱200 non-member base charges covering 0–10 m³
- [x] Define a version 2 ₱15 per m³ excess rate above 10 m³ for both customer types
- [x] Select the approved effective tariff automatically from the customer's classification
- [x] Reject invoice tariffs that do not match the customer's classification
- [x] Deploy member/non-member billing migrations and approved tariff versions 1 and 2 to the linked development database
- [x] Preserve the historical ₱10 excess tariff through November 1, 2026
- [x] Activate the ₱15 excess tariff beginning November 2, 2026

### Billing implementation

- [x] Create pure TypeScript billing functions
- [x] Validate current reading against previous reading
- [x] Calculate consumption
- [x] Apply tiered rates correctly
- [x] Apply fixed charges
- [x] Carry the database customer classification through reading confirmation and invoice preview
- [x] Apply balances, discounts, taxes, and penalties
- [x] Generate unique invoice identifiers
- [x] Save tariff snapshots with invoices
- [x] Save detailed invoice items
- [x] Make invoice creation idempotent
- [x] Prevent duplicate billing periods
- [x] Prevent editing finalized invoices without an audit record

### Invoice preview

- [x] Carry the actual billing period from customer details through reading confirmation
- [x] Load the approved effective tariff by customer classification and billing-period end date
- [x] Calculate preview consumption, itemized charges, total, and due date with the production billing engine
- [x] Show customer-friendly minimum-bill and additional-usage calculations that fit 58 mm receipts
- [x] Display the applied tariff name and version
- [x] Clearly label unsaved previews as non-final bills
- [x] Load saved invoices from immutable persisted invoice data
- [x] Handle preview loading and tariff-selection errors safely
- [x] Preserve customer, reading, classification, and billing-period context when editing a reading

### Billing tests

- [x] Test zero consumption
- [x] Test every tariff boundary
- [x] Test high consumption
- [x] Test minimum charges
- [x] Test discounts and subsidies
- [x] Test previous balances
- [x] Test penalties
- [x] Test meter rollover
- [x] Test replaced meters
- [x] Test rounding behavior
- [x] Confirm identical inputs always produce identical invoices
- [x] Verify member totals at 0, 5, 10, 11, and 15 m³
- [x] Verify non-member totals at 0, 5, 10, 11, and 15 m³

---

## Phase 5 — Bluetooth thermal printing

Implementation status: **Native Bluetooth foundation implemented and prebuild-validated on November 2, 2026.** Android and web production bundles pass. The generated Android manifest contains Android 12+ Nearby Devices permissions and legacy Bluetooth permissions capped at Android 11. A development APK, physical-phone installation, exact printer model, and real hardware acceptance evidence are still required.

### Hardware preparation

- [x] Define 58 mm printer procurement requirements
- [x] Define printer compatibility and physical test procedure in `Project setup/PRINTER_HARDWARE.md`
- [ ] Select supported 58 mm printer
- [ ] Select supported 80 mm printer if required
- [ ] Confirm printer Bluetooth mode and ESC/POS support
- [ ] Record printer manufacturer and model
- [ ] Test hardware before completing all billing features

### Native integration

- [x] Integrate `react-native-receipt-printer`, `react-native-bluetooth-classic`, and `react-native-permissions`
- [ ] Confirm the selected library stack in a compiled Expo SDK 58 development APK
- [x] Configure required native permissions
- [x] Configure Android 12+ Bluetooth permissions
- [x] Configure legacy Android Bluetooth permissions through Android 11
- [x] Add the required local Expo config plugin
- [ ] Create an Expo development build
- [ ] Install development build on a physical Android phone
- [x] Implement nearby-printer discovery flow
- [x] Implement Android pairing and connection flow
- [x] Save selected printer
- [x] Reconnect automatically when a saved printer exists
- [x] Handle disconnected and unavailable printers
- [x] Explain permission, Bluetooth-disabled, and development-build errors in the UI
- [x] Add Expo Go HTTP bridge for the Windows CrossEscPos virtual printer without a native TCP dependency
- [x] Auto-suggest the Windows LAN bridge URL from the Expo development host
- [x] Forward Expo Go receipts from HTTP port 9101 to ESC/POS TCP port 9100
- [x] Validate a receipt through the phone-facing LAN bridge endpoint to the running CrossEscPos virtual printer
- [x] Encode receipt barcodes and QR codes as native ESC/POS commands in the Windows virtual-printer bridge
- [x] Preserve ESC/POS line feeds and hide the CrossEscPos-specific Code 128 selector from receipt output
- [x] Align receipt columns by paper width, wrap long fields, and center the large amount-due block
- [ ] Confirm the rendered Code 128 bars are scannable in CrossEscPos and on the selected physical printer
- [x] Detect and safely reuse an already-running Windows virtual-printer bridge
- [x] Default Expo Go to Windows virtual-printer mode and disable native Bluetooth controls
- [x] Keep the Phase 5 Bluetooth option visible in Expo Go with development-build guidance
- [x] Prevent Expo Go from loading or subscribing to unsupported native Bluetooth printer modules
- [ ] Enable and verify native printer discovery in Phase 5 using an Expo development build and supported physical printer hardware (deferred)
- [ ] Verify pairing with a supported physical printer in the Phase 5 development build (deferred)

### Receipt printing

Implementation status: **Complete in code and automated validation.** Four receipt-template tests, billing tests, lint, typecheck, Android export, and web export pass. The print-audit migration is deployed to the linked development database and remote schema lint reports no errors. Physical receipt readability remains an acceptance-test requirement.

- [x] Create 58 mm receipt template
- [x] Create 80 mm receipt template
- [x] Print customer and invoice details
- [x] Print reading and consumption details
- [x] Print itemized charges
- [x] Print total and due date
- [x] Print invoice number and timestamp
- [x] Add test-print function
- [x] Add print progress and completion feedback
- [x] Add retry handling
- [x] Add controlled reprinting
- [x] Record every reprint attempt and result in append-only audit logs
- [x] Prevent accidental duplicate printing in local UI and backend authorization
- [x] Clearly label sample preview receipts as non-final

### Phase 5 acceptance tests

- [ ] Discover and pair a real printer
- [ ] Reconnect after closing the app
- [ ] Print readable 58 mm receipt
- [ ] Print readable 80 mm receipt if supported
- [ ] Recover from printer power loss
- [ ] Recover from Bluetooth disconnection
- [ ] Prevent accidental duplicate printing

---

## Phase 6 — Automatic water meter scanning

### Camera workflow

- [x] Request camera permission
- [x] Explain denied camera permission and provide a settings shortcut when it cannot be requested again
- [x] Open camera preview only after an active customer meter has been identified
- [x] Add meter framing and digit guides
- [x] Capture meter photograph
- [x] Allow photo retake
- [x] Compress photos appropriately at 70% JPEG quality
- [x] Store photos in the app-private documents directory with customer, meter, employee, and timestamp metadata in offline SQLite
- [ ] Upload photos when online

Camera implementation, typecheck, lint, QR routing tests, and Android production bundling passed on November 2, 2026. Physical-device camera capture and protected Supabase Storage upload remain pending.

### OCR integration

- [ ] Select and verify Google ML Kit OCR integration
- [x] Add required native configuration
- [ ] Create development build with OCR support
- [x] Crop the meter digit region
- [x] Detect meter digits
- [x] Separate whole and fractional digits
- [x] Display confidence or uncertainty
- [x] Require employee confirmation
- [x] Keep manual entry as a fallback

### Anomaly handling

- [x] Detect glare and blurred photos
- [x] Detect unreadable digits
- [x] Detect readings below the previous reading
- [x] Detect unusual consumption
- [x] Handle red fractional digits
- [x] Handle meter rollover
- [x] Handle replaced meters
- [x] Preserve original photograph for audits

OCR implementation status: **Integrated in code and automated validation on November 4, 2026.** The SDK 58 app uses an autolinked ML Kit adapter outside Expo Go, recognizes a derived center crop, keeps the original photo unchanged, separates explicit fractional digits, exposes uncertainty, and requires employee confirmation before copying the suggestion into editable fields. TypeScript, lint, Android production export, and nine recognition/photo-quality tests pass. Expo Doctor reports that the adapter has not been verified for React Native's New Architecture, so native development-build and physical-device verification remain unchecked.

### Phase 6 acceptance tests

- [ ] Build a real-meter photo test set
- [ ] Measure OCR accuracy
- [ ] Test bright sunlight
- [ ] Test low light
- [ ] Test glare and reflections
- [ ] Test dirty or scratched meter covers
- [ ] Test different meter models
- [ ] Confirm every OCR result can be manually corrected

---

## Phase 7 — Offline support and synchronization

### Local database

- [x] Design Expo SQLite schema
- [x] Add forward-only database migrations with startup schema validation
- [x] Cache assigned customers
- [x] Cache meter assignments
- [x] Cache previous readings
- [x] Cache approved tariff versions
- [x] Store and restore reading drafts
- [x] Store identified meter photos locally in the app-private documents directory and offline SQLite
- [x] Store saved invoice receipts for offline access
- [x] Explicitly disallow offline payment capture until cash-control approval

Local database implementation status: **Complete in code on November 5, 2026.** Schema version 3 uses WAL, parameterized writes, web-compatible migration/cache transactions with exclusive native writes, authenticated-owner scoping, required-table validation, and closed-handle recovery. Customer pages persist active assignments and latest readings independently; saved invoice receipts and SQLite drafts have offline read paths. Physical restart and airplane-mode verification remain in the Phase 7 acceptance tests.

### Synchronization queue

- [x] Create durable sync queue
- [x] Add unique client operation IDs
- [x] Add retry count and next-attempt time
- [x] Retry transient failures
- [x] Stop retrying permanent validation failures
- [x] Prevent duplicate records
- [x] Define conflict-resolution rules
- [x] Display pending sync count
- [x] Add manual retry control
- [x] Sync when the app returns to foreground
- [x] Sync when connectivity returns

Synchronization queue implementation status: **Complete in code on November 4, 2026.** Queue records are owner-scoped and durable, use idempotent client operation IDs, recover interrupted processing, retry transient failures with capped exponential backoff, and preserve permanent failures for review. The dashboard displays pending and failed work and supports manual retry. Physical airplane-mode and relaunch verification remains in the Phase 7 acceptance tests.

### Offline billing rules

- [x] Allow billing with approved cached tariffs
- [x] Prevent billing with expired or missing tariffs
- [x] Generate provisional statement when final billing is unavailable
- [x] Clearly label provisional output
- [x] Finalize provisional records after synchronization

Offline billing implementation status: **Complete in code and automated validation on November 4, 2026.** Reading and provisional-invoice data is committed atomically to the owner-scoped SQLite database, cached tariffs must remain approved, classification-matched, unarchived, and effective for the billing date, and printed provisional statements are marked `PROVISIONAL - NOT A FINAL BILL`. Synchronization idempotently creates the server reading and invoice, then replaces the local provisional identity and label with the server invoice.

### Phase 7 acceptance tests

- [ ] Complete a reading with airplane mode enabled
- [ ] Restart the app without losing pending data
- [ ] Synchronize after reconnecting
- [ ] Prevent duplicate readings after repeated retries
- [ ] Resolve server and local conflicts safely
- [ ] Recover after forced app termination
- [ ] Recover after partial photo upload

Phase 7 acceptance status: **Physical-device evidence pending (audited November 4, 2026).** Fifteen automated offline-billing, receipt, synchronization, and evidence-validation tests pass. The local manifest exists and the runner reports its seven untested scenarios as `PENDING`. The local Git `master` branch is valid and no `EXPO_TOKEN` override is present. The direct password login was rejected, so authenticate through Expo's device/browser flow with the account's existing provider and grant Developer-or-higher access, or use a private project-creation token as documented in `Project setup/PHASE7_ACCEPTANCE.md`. Then initialize EAS and install the NMMPC Android development build. Keep these boxes unchecked until every scenario passes with recorded evidence.

---

## Phase 8 — Admin web dashboard

### Arrears and allocation ledger

- [x] Preserve monthly invoices as the bill ledger instead of creating a duplicate bills table
- [x] Add immutable payment allocations linked to payments and monthly invoices
- [x] Separate each invoice's original current charge from its displayed prior-arrears snapshot
- [x] Derive customer arrears from unpaid original bill balances without duplicating debt
- [x] Add idempotent, transactional oldest-due-first customer payment allocation
- [x] Reject zero payments and overpayments when no explicit credit policy exists
- [x] Integrate live previous arrears into mobile invoice calculation and receipts
- [x] Show allocation-aware customer balances in mobile customer details
- [x] Update the admin collection form for customer-level full and partial payments
- [x] Show allocation-aware current bill, previous arrears, current payment, remaining balance, and status on the admin overview
- [x] Calculate the admin overview outstanding total from original invoice charges minus completed allocations
- [x] Deploy `20261105000000_arrears_management.sql` to the hosted Supabase project
- [ ] Convert every admin report and export to read the allocation ledger (deferred until the migration is deployed)
- [ ] Add an audited payment-reversal RPC that reverses allocations without deleting financial history
- [ ] Add confirmed offline payment replay; offline payment capture remains disabled until server allocation succeeds
- [ ] Run hosted concurrency, duplicate-retry, multiple-overdue-month, correction, and reversal acceptance tests

Implementation status: **Dashboard feature implementation complete on November 4, 2026.** The sibling Next.js 16 application includes protected Supabase administrator authentication, responsive management screens, reports, CSV exports, and validated CSV/Excel imports. Lint, TypeScript, production build, mobile lint/typecheck, and the admin production dependency audit pass. Deployment environment values and live administrator acceptance evidence remain pending.

### Project setup

- [x] Create sibling `water-meter-admin` Next.js project
- [x] Configure TypeScript and Tailwind CSS
- [x] Connect dashboard to Supabase
- [x] Configure administrator authentication
- [x] Configure the local admin dashboard with the public Supabase URL and publishable key
- [ ] Configure deployment environment

### Dashboard features

- [x] Create overview dashboard
- [x] Add billing and collection charts
- [x] Add customer management
- [x] Add meter management
- [x] Add meter assignment management
- [x] Add tariff management
- [x] Add invoice management
- [x] Add payment and collection management
- [x] Add unpaid-account reports
- [x] Add employee management
- [x] Add route and assignment management
- [x] Add audit-log viewer
- [x] Add billing-period reports
- [x] Add export to CSV or spreadsheet
- [x] Add Excel and CSV import for customers, membership classification, meters, and opening readings
- [x] Require a stable account number or meter number instead of matching customers by full name alone
- [x] Generate customer and reading UUIDs in Supabase rather than deriving IDs from alphabetical order
- [x] Sort import previews alphabetically without changing record identity
- [x] Validate `member` and `non_member` values, reading ranges, meter ownership, and billing periods before import
- [x] Preview valid and rejected rows before committing an import
- [x] Make repeated file imports idempotent and prevent duplicate customers, meters, and readings
- [x] Record each import and its row-level results in the audit log
- [x] Add responsive tablet and desktop layouts
- [x] Add safe meter reassignment without rewriting ended assignment history
- [x] Prevent overpayments and derive paid or partially-paid invoice status from recorded collections
- [x] Restrict unsafe invoice status transitions
- [x] Prevent administrator self-lockout and removal of the final active administrator
- [x] Harden imports against duplicate identifiers, oversized batches, and bypassed client validation
- [x] Neutralize spreadsheet formulas in CSV exports

### Phase 8 acceptance tests

- [x] Administrator can operate the system without editing the database directly
- [x] Employees cannot access admin-only features
- [x] Reports match database totals
- [x] Exports contain correct records
- [x] Tariff changes are versioned and auditable

Phase 8 acceptance status: **All hosted checks passed on November 5, 2026.** Dedicated administrator and employee accounts verified operational workflows and authorization, shared report/export helpers matched live database records, and the deployed append-only tariff audit migration passed its acceptance check. The hosted schema also includes the arrears allocation ledger and passed remote database lint with no errors.

---

## Phase 9 — Security and quality assurance

### Security

- [ ] Review all Supabase RLS policies
- [ ] Review environment-variable handling
- [ ] Confirm no secrets exist in the repository
- [ ] Add secure session storage
- [ ] Add lost-device session revocation
- [ ] Add employee disable and offboarding process
- [ ] Review storage-bucket permissions
- [ ] Review photo retention requirements
- [ ] Add privacy notice and consent where required
- [ ] Review dependency vulnerabilities
- [ ] Verify New Architecture compatibility or replace the OCR and Bluetooth printer native packages flagged by Expo Doctor
- [ ] Move assignment and payment multi-record writes into row-locking database RPCs for full concurrency safety (deferred from the Phase 8 dashboard review)

### Automated testing

- [ ] Add billing-engine unit tests
- [ ] Add data-validation unit tests
- [ ] Add component tests
- [ ] Add navigation tests
- [ ] Add Supabase policy tests
- [ ] Add synchronization tests
- [ ] Add invoice idempotency tests
- [ ] Add duplicate-submission tests

### Manual and hardware testing

- [ ] Test supported Android versions
- [ ] Test low-end Android device performance
- [ ] Test slow and unstable networks
- [ ] Test offline recovery
- [ ] Test printer compatibility matrix
- [ ] Test OCR accuracy targets
- [ ] Test lost-device response
- [ ] Test failed and partial payments
- [ ] Test duplicate invoice attempts
- [ ] Test data isolation between employees
- [ ] Complete user acceptance testing with field employees

### Phase 9 acceptance criteria

- [ ] No unresolved critical billing defects
- [ ] No unresolved privacy or authorization defects
- [ ] No unresolved synchronization data-loss defects
- [ ] No unresolved critical printer workflow defects
- [ ] Pilot users approve the main workflow

---

## Phase 10 — Deployment and operations

### Production services

- [ ] Configure production Supabase project
- [ ] Apply production database migrations
- [ ] Apply and verify production RLS policies
- [ ] Configure database backups
- [ ] Configure storage retention
- [ ] Configure monitoring and error reporting
- [ ] Configure production dashboard environment
- [ ] Deploy admin dashboard to Vercel

### Android deployment

- [ ] Create EAS project
- [ ] Configure `eas.json`
- [ ] Configure development build profile
- [ ] Configure preview build profile
- [ ] Configure production build profile
- [ ] Configure Android application identifier
- [ ] Configure signing credentials
- [ ] Build signed APK for pilot testing
- [ ] Build signed AAB for store distribution if required
- [ ] Install pilot build on employee devices
- [ ] Document device enrollment and replacement

### Updates and operations

- [ ] Configure EAS Update channels
- [ ] Define over-the-air update policy
- [ ] Define native-build update policy
- [ ] Create backup and restoration runbook
- [ ] Create incident-response procedure
- [ ] Create printer troubleshooting guide
- [ ] Create employee training guide
- [ ] Create administrator training guide
- [ ] Define support contacts and escalation path
- [ ] Define audit and reconciliation schedule

### Pilot acceptance criteria

- [ ] Employees can authenticate
- [ ] Employees can find or scan assigned customers
- [ ] Employees can capture and confirm readings
- [ ] Billing calculations are correct
- [ ] Receipts print reliably
- [ ] Offline work synchronizes without duplicates
- [ ] Administrators can reconcile invoices and payments
- [ ] Backups and recovery have been tested
- [ ] Production pilot is approved for rollout

---

## MVP milestone

- [x] Employee login interface
- [x] Select customer using sample data
- [x] Enter meter reading manually
- [x] Calculate sample water bill
- [x] Generate invoice preview
- [ ] Authenticate a real employee
- [ ] Load real customers from Supabase
- [ ] Calculate bill using approved production tariffs
- [ ] Print receipt through Bluetooth
- [ ] Save invoice to Supabase
- [ ] Complete the workflow on actual field hardware

The MVP is complete only when the entire real-data workflow works on a physical Android device and a supported Bluetooth thermal printer.

---

## Final release sign-off

- [ ] Product owner approval
- [ ] Billing rules approval
- [ ] Security review approval
- [ ] Data privacy approval
- [ ] Field employee acceptance
- [ ] Administrator acceptance
- [ ] Printer hardware acceptance
- [ ] Backup and recovery verification
- [ ] Production deployment approval

