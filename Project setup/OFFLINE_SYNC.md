# Offline Database and Synchronization

The field app uses `nmmpc-offline.db`, a persistent Expo SQLite database initialized at application startup. `PRAGMA user_version` controls forward-only local schema migrations and WAL mode reduces blocking between reads and writes.

## Cached data

Every cache row is scoped to the authenticated user ID so one employee cannot read another employee's downloaded route data through application queries. The database stores assigned customers, meters, assignment history, prior readings, approved tariff versions and tiers, reading drafts, local photo references, and offline invoice receipts. Server data refreshes the cache after successful authorized Supabase reads; network failures fall back to cached customer pages, previously opened customer details, and saved invoice receipts.

Offline payment capture is explicitly disabled until the product owner approves a cash-control and reconciliation procedure. The reserved local table is retained for a forward-compatible migration, but application storage and queue APIs reject payment writes while offline.

## Synchronization queue

Offline mutations receive a UUID `client_operation_id` and are stored locally before being placed in `sync_queue`. A unique entity/action constraint collapses repeated queue submissions. Server writes use the same idempotency key so retrying an operation cannot create duplicate readings, invoices, or payments.

Transient network and service failures use exponential backoff capped at one hour. Each item moves to `processing` before upload; interrupted items return to `pending` on the next synchronization pass. Validation, authorization, and other permanent failures stop retrying, preserve their payload and error, and appear separately on the dashboard. Synchronization runs when connectivity returns and whenever the app becomes active. The dashboard shows pending and failed counts plus a manual retry control for eligible pending work.

## Conflict rules

- Supabase remains authoritative for customers, meter assignments, historical readings, and approved tariffs. A successful download replaces the matching cached representation.
- Client-created financial and reading records are append-only and identified by `client_operation_id`; they are never merged by timestamp or silently overwritten.
- A server uniqueness or billing-period conflict is permanent and requires review. The client preserves the local payload and error instead of generating another record.
- Drafts remain local and editable until submission. Submitting creates an immutable queued payload with a new operation ID.
- Meter photos upload through the protected storage workflow. Transient partial uploads retain their queue record for retry, while permanent policy or validation failures remain visible for review.

Cached tariffs are eligible only when the billing-period date falls inside their approved effective range. The billing engine must refuse final billing when no matching cached tariff exists; provisional statements are deferred until the Phase 7 billing workflow is implemented.

