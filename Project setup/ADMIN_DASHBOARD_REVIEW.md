# Admin dashboard feature review

Reviewed on November 5, 2026 against the Next.js dashboard and Supabase rules.

| Feature | Main weakness found | Improvement made | Remaining limitation |
|---|---|---|---|
| Authentication | Profile authorization could only be inferred from the page | Dashboard layout and every server mutation require an active administrator | Auth identity creation and password recovery remain in Supabase Auth |
| Overview | Voided invoices and unrelated completed payments could distort totals | Totals now exclude void invoices and match completed payments to non-void invoice IDs | No configurable date or route filter |
| Customers | Status changes were supported, but bulk data quality depends on stable account numbers | Stable account numbers, classification validation, route and employee assignment remain enforced | Full inline customer editing and search are still desirable |
| Meters | Administrators could register meters but not manage operational status | Added status controls and blocked deactivation while a meter has an active assignment | Meter replacement remains a separate mobile atomic workflow |
| Routes and assignments | Ended assignments could not be reused; create could partially succeed | Added safe reassign-as-new-period, availability filtering, conflict checks, and compensating rollback | A database RPC is still preferred for true concurrency-safe atomicity |
| Tariffs | Approval order was previously unsafe | Tariffs are drafts first, tiers are added next, and approval is a separate immutable transition | Production tariff audit migration still requires deployment |
| Invoices | Any status could be selected manually | Added controlled transitions; paid and partially-paid states are payment-derived | A dedicated reversal/credit-note workflow is not yet present |
| Payments | Draft invoices and overpayments could be accepted by the UI | Payments are limited to eligible invoices and live balances; invoice state updates automatically | A database RPC is still preferred to eliminate concurrent-payment races |
| Employees | An administrator could accidentally remove their own or the final admin access | Added self-lockout and last-active-administrator guards | Creating the underlying login still requires Supabase Auth |
| Reports | Report logic was correct but overview/export used different calculations | Reused invoice-linked totals and exported actual remaining balances | No date, route, or employee filters yet |
| Imports | Client validation could be bypassed; duplicate rows and oversized files were unclear | Added server validation, duplicate-key detection, 5 MB/5,000-row limits, and disabled empty commits | Large imports remain sequential and should later use a background job |
| Audit log | Metadata was truncated and difficult to inspect | Added expandable formatted metadata | Tariff trigger coverage depends on the pending migration |
| Exports | CSV cells could trigger spreadsheet formulas | Formula-like values are neutralized and every field remains quoted | Native XLSX export is not implemented |

## Recommended next database hardening

Move assignment creation/reactivation and payment-plus-invoice updates into security-definer Supabase RPCs that lock the affected rows. The current server actions validate and compensate on failure, but only a database transaction can fully prevent races between two administrators submitting at the same time.
