# Mobile App Flow Review

Reviewed and improved on November 5, 2026 for the Expo SDK 58 mobile application.

## Recommended field workflow

1. Sign in as an authorized employee.
2. Open the dashboard and select an unread active customer, search the customer list, or scan a meter QR code.
3. Verify the customer and active meter on the customer-details screen.
4. Record the meter value and capture evidence when the condition is exceptional.
5. Review and explicitly confirm unusual, rollover, or replacement readings.
6. Save the invoice, print if needed, and finish at the customer queue to choose the next account.

## Feature review and improvements

| Area | Previous weakness | Improvement |
| --- | --- | --- |
| Authentication | Protected groups relied on an implicit redirect. | Guest and authenticated route groups now have explicit redirect destinations. |
| Back navigation | A deep link could have no screen to return to. | Headers use a safe fallback route; saved invoices finish at the customer queue. |
| Bottom navigation | Peer destinations used the same stack motion regardless of their position. | Home, Customers, and Printer now slide according to their left-to-right order, replace the peer screen instead of piling up duplicates, and visibly highlight the active widget. |
| Button feedback | Buttons, cards, filters, and selectors used inconsistent or abrupt pressed states. | Interactive press controls now share a short native-driven scale transition and automatically stay still when the device requests reduced motion. |
| Dashboard | Greeting was fixed and the queue could show completed or ineligible accounts. | Greeting follows local time and the next queue contains active, metered customers not read today. |
| Data freshness | Returning from a reading could leave customer and dashboard data stale. | Dashboard, customer list, and customer details refresh whenever they regain focus. |
| Customer selection | An inactive account, missing meter, or already-covered billing date could enter reading flow. | Customer details explain the block and direct the employee to another customer. |
| QR scan | Denied camera access did not provide a direct recovery path. | Permanently denied access offers an Open settings action. |
| Reading entry | Leaving could silently abandon work; exceptional states were too easy to continue without evidence. | Header and Android Back prompt to stay, discard, or save a draft. Rollover, replacement, and unreadable conditions require a photo. |
| Reading review | Only high usage required explicit acknowledgement. | High usage, rollover, and meter replacement require confirmation before invoicing. |
| Unreadable meters | The workflow lacked a clear non-billing completion path. | Employees can save the evidence as follow-up work without creating an invoice. |
| Workflow orientation | Each screen used different or duplicated step UI. | Reading, Review, and Invoice use one accessible three-step progress component. |
| Date handling | UTC date slicing could select the previous or next billing date near midnight. | Billing dates use the device's local calendar date. |
| Invoice completion | Back could reopen a completed confirmation flow. | Saved invoices dismiss to the customer queue, including Android hardware Back. |

## Validation completed

- TypeScript type check: passed.
- Expo lint, including React Compiler rules: passed.
- Phase 6 meter-recognition and photo-quality suite: 10 of 10 passed.
- QR meter-scan suite: 2 of 2 passed.
- Android production export: passed.
- Expo Doctor: 19 of 20 checks passed. Its remaining package-metadata check flags the OCR and Bluetooth packages as untested on React Native's New Architecture, and two other native packages have no React Native Directory metadata.

## Remaining real-device checks

The implementation is ready for device QA, but these checks remain intentionally open in `DEVELOPMENT_CHECKLIST.md`:

- Complete the entire workflow on a physical Android phone.
- Confirm Android hardware Back behavior at reading, confirmation, and saved-invoice stages.
- Verify camera permission recovery, QR scanning, meter-photo capture, and Bluetooth printing.
- Verify keyboard behavior, long customer data, and common small-screen sizes.
- Compare the final screens with the approved Figma file.
- Verify the flagged OCR and Bluetooth native packages on the supported development build and Android hardware; replace them if New Architecture compatibility fails.

## Flow rules to preserve

- Do not allow a reading unless the customer is active and has an active meter assignment.
- An ended assignment remains historical. Reactivating the same customer should create or restore a valid active assignment through the administrator workflow rather than altering reading history.
- Never create an invoice for an unreadable meter.
- Never bypass explicit review for exceptional readings.
- Treat the saved invoice as the terminal screen for one customer workflow.
