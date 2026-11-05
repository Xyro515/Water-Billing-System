# NMMPC Billing Rules

These rules define how an approved tariff version is interpreted. Monetary rates and tax treatment must be approved by NMMPC before a tariff is activated; the schema defaults tax, discounts, subsidies, penalties, and the minimum charge to zero.

## Member and non-member water rates

The current approved version 2 tariffs are effective beginning November 2, 2026. Version 1 remains preserved for billing periods from January 1 through November 1, 2026.

| Customer type | Included consumption | Base / minimum bill | Excess rate |
| --- | ---: | ---: | ---: |
| Organization member | 0–10 m³ | ₱150.00 | ₱15.00 per m³ above 10 m³ |
| Non-member | 0–10 m³ | ₱200.00 | ₱15.00 per m³ above 10 m³ |

The base charge is not prorated when consumption is below 10 m³. The calculation is:

`total current charge = base charge + max(0, consumption - 10) × ₱15`

Invoice previews and new invoice line items use concise customer-facing wording suitable for 58 mm receipts. A member using 11 m³, for example, shows `Member minimum (0-10 m3)` at PHP 150.00 and `Additional 1 m3 x PHP 15.00` at PHP 15.00. Non-member rows use `Non-member minimum (0-10 m3)` with the same additional-usage format. Zero-value included-consumption tier rows are omitted because the minimum line already explains the included 0–10 m³ allowance.

Examples before balances, discounts, taxes, or penalties:

| Consumption | Member | Non-member |
| ---: | ---: | ---: |
| 0 m³ | ₱150.00 | ₱200.00 |
| 5 m³ | ₱150.00 | ₱200.00 |
| 10 m³ | ₱150.00 | ₱200.00 |
| 11 m³ | ₱165.00 | ₱215.00 |
| 15 m³ | ₱225.00 | ₱275.00 |

Each customer stores a required `customer_type`. Billing selects the matching approved, effective tariff automatically. The database rejects an invoice whose tariff customer type does not match its customer.

## Tariff selection and auditability

1. Select the one approved tariff whose inclusive effective-date range contains the billing-period end date.
2. Approved effective ranges for the same tariff code cannot overlap.
3. A tariff is identified by `code` and a positive `version`. Once approved, its rules and tiers are immutable. Changes require a new version.
4. Finalized invoices retain `tariff_id` and an immutable `tariff_snapshot` containing every rule and tier used.

## Consumption and tiers

1. Normal consumption is `current reading - previous reading` and cannot be negative.
2. For an employee-confirmed rollover, consumption is `meter_rollover_value + current reading - previous reading`. The default register value is 1,000 m³ and is configurable per tariff.
3. A replaced meter starts from its recorded initial reading. Replacement and rollover must be explicitly recorded as the meter-reading condition.
4. Tiers are progressive. Each tier covers `[minimum_volume, maximum_volume)`; the final tier is open-ended. Approved tiers must start at zero, be contiguous, and have no overlaps.

## Charge order

1. Calculate each progressive tier charge and round the line item according to the tariff.
2. Add the fixed service charge.
3. Apply the minimum current-period charge: `max(usage charge + fixed charge, minimum_charge)`.
4. Apply the percentage discount, then the fixed subsidy. Discounts and subsidy cannot reduce the current-period charge below zero.
5. Calculate tax on the discounted current-period charge. `tax_name = None` and `tax_rate = 0` mean no customer-facing tax is applied.
6. If enabled, add the previous unpaid balance.
7. After the configured grace period, calculate the penalty from the eligible overdue previous balance and add it once for the invoice period.
8. The total is the non-negative sum of the current-period charge, tax, previous balance, and penalty.

## Dates and rounding

1. The due date is the billing-period end date plus `due_days` calendar days. The default is 15 days.
2. Currency calculations default to two decimal places using `half_up` rounding. Supported modes are `half_up`, `half_even`, `up`, and `down`, with zero to four decimal places.
3. Store calculation inputs and unrounded intermediate values in the tariff snapshot for audit reproduction. Display and invoice line items use the configured rounding rule.

## Approval requirement

Tax applicability depends on NMMPC's legal entity, registration, and franchise status. Do not activate a non-zero tax rate without written accounting or legal approval. Discounts, subsidies, penalties, minimum charges, tier rates, fixed charges, due days, and rollover values likewise require an approved tariff resolution.

