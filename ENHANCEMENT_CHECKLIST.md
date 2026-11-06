# NMMPC — Enhancement Checklist

Last updated: November 6, 2026

This checklist tracks improvements and enhancements for the NMMPC water-meter billing mobile application and administrator dashboard. Complete high-priority financial and reliability work before visual polish or production rollout.

## Priority 1 — Billing and payment safety

- [ ] Convert every report and CSV export to use the payment-allocation ledger.
- [ ] Add an audited payment-reversal RPC that preserves the original payment and allocation history.
- [ ] Move payment and meter-assignment multi-record writes into row-locking database RPCs.
- [ ] Test partial payments across multiple overdue invoices.
- [ ] Test concurrent payments and repeated payment submissions.
- [ ] Add a reconciliation view for invoices, payments, allocations, and remaining balances.
- [ ] Verify that every new payment displays its generated reference in the ledger, details view, exports, and receipt.
- [ ] Verify that every saved invoice displays its invoice reference on screen and in printed output.

## Priority 2 — Admin dashboard usability

- [x] Add a **View all balances** action below the Top 10 customer-balance table.
- [x] Add search, filters, date ranges, sorting, and pagination to payment records.
- [x] Add search, filters, date ranges, sorting, and pagination to invoices.
- [x] Add search, filters, sorting, and pagination to customers.
- [x] Add search, event filters, date ranges, and pagination to audit logs.
- [x] Show the invoices and amounts covered by each payment in payment details.
- [x] Add printable payment receipts.
- [x] Preserve controlled invoice-reprint reasons and expose reprint history to administrators.
- [x] Add clear confirmation dialogs for disabling accounts, tariff approvals, invoice status changes, and any future reversal action.
- [x] Add dashboard alerts for overdue accounts, failed imports, synchronization failures, and unusual payment activity.
- [x] Improve empty, loading, validation, and database-error states.
- [x] Improve responsive table behavior on tablets and narrow screens.

## Priority 3 — Mobile field workflow

- [ ] Complete the reading-to-invoice workflow on a physical Android device.
- [ ] Verify Bluetooth printer discovery, pairing, reconnection, and printing.
- [ ] Verify 58 mm and 80 mm receipt formatting on supported printers.
- [ ] Test camera capture and OCR using real NMMPC water meters.
- [ ] Measure OCR accuracy in bright light, low light, glare, and dirty-meter conditions.
- [ ] Verify offline reading capture, application restart, reconnection, and synchronization.
- [ ] Verify that retrying synchronization cannot create duplicate readings or invoices.
- [ ] Upload locally stored meter photographs when connectivity returns.
- [ ] Improve failed-synchronization explanations and recovery controls for employees.
- [ ] Test small screens, large text, long customer names, keyboard behavior, and screen readers.

## Priority 4 — Security and auditability

- [ ] Store authenticated sessions in encrypted secure storage.
- [ ] Complete a Supabase Row Level Security policy review.
- [ ] Confirm that no secret or service-role credentials exist in either client application.
- [ ] Add lost-device session revocation.
- [ ] Document and test employee disabling and offboarding.
- [ ] Review meter-photo access, privacy, retention, and deletion rules.
- [ ] Review dependency vulnerabilities.
- [ ] Verify New Architecture compatibility for the OCR and Bluetooth native packages or replace them.
- [ ] Add administrator audit alerts for reversals, account changes, tariff changes, and repeated failed operations.

## Priority 5 — Testing and maintainability

- [ ] Expand billing-engine and data-validation unit tests.
- [ ] Add mobile component tests.
- [ ] Add navigation and protected-route tests.
- [ ] Add synchronization and invoice-idempotency tests.
- [ ] Add duplicate-submission tests for financial operations.
- [ ] Break large screens and forms into smaller reusable components where useful.
- [ ] Remove remaining sample-data and placeholder behavior from production workflows.
- [ ] Replace raw database errors with consistent user-friendly messages.
- [ ] Keep `DEVELOPMENT_CHECKLIST.md` aligned with completed implementation and validation.

## Priority 6 — Production readiness

- [ ] Create separate staging and production Supabase environments.
- [ ] Apply and verify production migrations and RLS policies.
- [ ] Configure database backups and test restoration.
- [ ] Configure application monitoring, error reporting, and operational alerts.
- [ ] Deploy the administrator dashboard with production environment values.
- [ ] Create signed Android pilot builds and install them on field devices.
- [ ] Create administrator and employee training guides.
- [ ] Create printer-troubleshooting, backup, and incident-response guides.
- [ ] Complete field-employee and administrator user-acceptance testing.
- [ ] Obtain production rollout approval.

## Enhancements already completed

- [x] Generate human-readable payment references automatically.
- [x] Show invoice references on the invoice screen and printed receipt.
- [x] Improve audit-log details with metadata, before-and-after changes, and raw-data fallback.
- [x] Add controlled invoice-reprint reasons.
- [x] Calculate customer balances from the payment-allocation ledger.
- [x] Separate payments applied to previous arrears from payments applied to the current bill.
- [x] Limit the administrator overview to the 10 highest remaining customer balances.
- [x] Use the full organization name: New Murcia Multipurpose Cooperative.
- [x] Generate stable meter asset numbers automatically while displaying customer names only as assignment context.

## Completion rule

Check an item only when the implementation is present and its relevant automated or physical-device validation has passed. Keep hardware, deployment, account-setup, and user-acceptance items unchecked until direct evidence is available.
