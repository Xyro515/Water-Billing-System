import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCachedTariffEligible, finalizeProvisionalReceipt, isProvisionalInvoiceSyncPayload } from '../src/lib/offlineBilling.ts';
import type { BillingTariff } from '../src/lib/billing.ts';
import type { WaterBillReceipt } from '../src/lib/receipt.ts';

const tariff: BillingTariff = {
  id: '00000000-0000-4000-8000-000000000001', code: 'MEMBER_RESIDENTIAL', name: 'Member tariff', version: 2,
  effective_from: '2026-11-01', effective_to: '2026-12-31', fixed_charge: 150, currency: 'PHP', customer_type: 'member',
  tax_name: 'None', tax_rate: 0, discount_rate: 0, subsidy_amount: 0, penalty_rate: 0, penalty_grace_days: 0,
  due_days: 15, minimum_charge: 150, apply_previous_balance: false, meter_rollover_value: 1000,
  rounding_scale: 2, rounding_mode: 'half_up', is_approved: true, approved_by: null, approved_at: '2026-11-01T00:00:00Z',
  created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', archived_at: null,
};

const receipt: WaterBillReceipt = {
  invoiceId: 'local-invoice', invoiceNumber: 'PROVISIONAL-MEMBER-0001', issuedAt: '2026-11-04T00:00:00Z',
  billingPeriod: '2026-11-01 to 2026-11-30', dueDate: '2026-12-15', customerName: 'Member One',
  accountNumber: 'MEMBER-0001', serviceAddress: 'Test address', meterNumber: 'METER-0001', previousReading: 10,
  currentReading: 20, consumption: 10, charges: [{ description: 'Member minimum', amount: 150 }], totalAmount: 150,
  status: 'provisional', provisional: true,
};

test('allows only approved, matching, effective cached tariffs', () => {
  assert.doesNotThrow(() => assertCachedTariffEligible(tariff, 'member', '2026-11-30'));
  assert.throws(() => assertCachedTariffEligible({ ...tariff, is_approved: false }, 'member', '2026-11-30'), /not approved/);
  assert.throws(() => assertCachedTariffEligible(tariff, 'non_member', '2026-11-30'), /classification/);
  assert.throws(() => assertCachedTariffEligible(tariff, 'member', '2027-01-01'), /effective/);
  assert.throws(() => assertCachedTariffEligible({ ...tariff, archived_at: '2026-11-15T00:00:00Z' }, 'member', '2026-11-30'), /not approved/);
});

test('recognizes complete provisional synchronization payloads', () => {
  const payload = { sync_kind: 'provisional_invoice', customer_id: 'customer', status: 'provisional', client_operation_id: 'invoice-operation', reading: { client_operation_id: 'reading-operation' }, invoice_request: { p_client_operation_id: 'invoice-operation' }, receipt };
  assert.equal(isProvisionalInvoiceSyncPayload(payload), true);
  assert.equal(isProvisionalInvoiceSyncPayload({ ...payload, reading: null }), false);
});

test('replaces provisional identity and labeling after server synchronization', () => {
  const finalized = finalizeProvisionalReceipt(receipt, { id: 'server-id', invoice_number: 'NMMPC-202611-00000001', issued_at: '2026-11-04T01:00:00Z', status: 'draft' });
  assert.equal(finalized.invoiceId, 'server-id');
  assert.equal(finalized.invoiceNumber, 'NMMPC-202611-00000001');
  assert.equal(finalized.provisional, false);
  assert.equal(finalized.preview, false);
  assert.equal(finalized.status, 'draft');
});
