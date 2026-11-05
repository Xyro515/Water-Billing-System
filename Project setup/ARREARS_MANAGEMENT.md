# Arrears Management

Implemented and deployed to the hosted Supabase project on November 5, 2026. The remote schema passed database lint and all Phase 8 hosted acceptance checks passed.

## Model used

The existing `invoices` table remains the monthly bill ledger. A second `bills` table would duplicate financial records, so the implementation adds `payment_allocations` instead.

- `invoices.current_amount` is the original charge created by that billing period.
- `invoices.previous_balance` is the arrears snapshot displayed on that statement.
- `invoices.total_amount` is the statement total shown to the customer.
- `payment_allocations.amount` is the amount of a completed payment assigned to one invoice.
- Invoice balance is `current_amount - completed allocations`.
- Customer arrears is the sum of positive balances from prior, non-void invoices.

Because arrears is calculated from prior invoice balances, the previous balance displayed on a new statement does not become new debt again.

## Payment transaction

`record_customer_payment` performs one locked database transaction:

1. Authenticate the collector and confirm customer access.
2. Return an existing payment when the operation ID is retried.
3. Lock the customer's invoices.
4. Reject zero payments, customers without debt, and overpayments.
5. Create the payment.
6. Allocate it to open invoices ordered by due date, billing period, and creation time.
7. Update covered invoice statuses.
8. Append an audit event.

The admin dashboard now accepts a customer-level payment rather than requiring the administrator to manually choose one invoice.

The admin overview also shows an allocation-aware customer balance table with:

- Current bill from the latest finalized billing period.
- Net remaining arrears from older invoices.
- Completed payments allocated to the current bill.
- Total remaining balance across current and older bills.
- Unpaid, partially paid, overdue, or paid status.

The overview outstanding total uses the same calculation as the customer rows.

## Mobile behavior

Before producing the invoice preview, the app requests arrears that existed before the new billing period. The billing engine then displays current charges, previous arrears, applicable penalties, and the statement total. Customer details use the same derived arrears source.

The invoice screen and printed receipt explicitly separate `Current bill` and `Previous balance` before showing `Total amount due`. After reading confirmation, the employee can choose `Save and print invoice` or `Save without printing`. The invoice is persisted before printing, and controlled reprints remain audited.

If the arrears query cannot be confirmed, billing stops instead of silently issuing a statement that omits debt. Offline payment capture remains disabled until the server confirms allocation.

## Deployment

The migration is deployed. The commands below are retained for future environments.

Apply the migration before deploying either updated client:

```powershell
npx supabase db push
```

Migration: `supabase/migrations/20261105000000_arrears_management.sql`

After deployment, regenerate mobile database types and run hosted acceptance tests with two administrators attempting payments against the same customer to verify row locking.

## Validated locally

- Mobile TypeScript and Expo lint passed.
- Admin TypeScript and ESLint passed.
- Four arrears allocation tests passed.
- Fourteen billing-engine tests passed.
- Existing admin utility tests passed.

## Still required

- Change every report and CSV export to use allocation rows rather than the legacy payment-to-first-invoice link.
- Add audited payment reversal that creates compensating financial history.
- Add safe offline payment replay and confirmation.
- Run dedicated hosted concurrency and duplicate-retry tests for simultaneous payments against the same customer.
