import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBill, calculateConsumption, roundBillingValue, type BillingInput, type BillingTariff, type BillingTier } from '../src/lib/billing.ts';

const tariff: BillingTariff = {
  id: '00000000-0000-4000-8000-000000000001', code: 'TEST', name: 'Test tariff', version: 1,
  effective_from: '2026-01-01', effective_to: null, fixed_charge: 50, currency: 'PHP', customer_type: 'member', is_approved: true,
  approved_by: null, approved_at: '2026-01-01T00:00:00Z', archived_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  tax_name: 'VAT', tax_rate: 0.12, discount_rate: 0, subsidy_amount: 0, penalty_rate: 0.02,
  penalty_grace_days: 5, due_days: 15, minimum_charge: 0, apply_previous_balance: true,
  meter_rollover_value: 1000, rounding_scale: 2, rounding_mode: 'half_up',
};
const tiers: BillingTier[] = [
  { id: '1', tariff_id: tariff.id, minimum_volume: 0, maximum_volume: 10, rate_per_unit: 10, sort_order: 1, created_at: '', updated_at: '' },
  { id: '2', tariff_id: tariff.id, minimum_volume: 10, maximum_volume: 20, rate_per_unit: 15, sort_order: 2, created_at: '', updated_at: '' },
  { id: '3', tariff_id: tariff.id, minimum_volume: 20, maximum_volume: null, rate_per_unit: 25, sort_order: 3, created_at: '', updated_at: '' },
];
const input = (currentReading: number, overrides: Partial<BillingInput> = {}): BillingInput => ({ previousReading: 100, currentReading, condition: 'normal', billingPeriodStart: '2026-10-01', billingPeriodEnd: '2026-10-31', ...overrides });

test('zero consumption applies only fixed charge and tax', () => { const result = calculateBill(input(100), tariff, tiers); assert.equal(result.consumption, 0); assert.equal(result.subtotal, 0); assert.equal(result.totalAmount, 56); });
test('tier boundaries are progressive and exact', () => { assert.equal(calculateBill(input(110), tariff, tiers).subtotal, 100); assert.equal(calculateBill(input(120), tariff, tiers).subtotal, 250); assert.equal(calculateBill(input(121), tariff, tiers).subtotal, 275); });
test('high consumption traverses the open tier', () => { assert.equal(calculateBill(input(150), tariff, tiers).subtotal, 1000); });
test('minimum charge applies after usage and fixed charge', () => { const result = calculateBill(input(100), { ...tariff, fixed_charge: 0, minimum_charge: 100, tax_rate: 0, tax_name: 'None' }, tiers); assert.equal(result.totalAmount, 100); assert.equal(result.items.find((item) => item.item_type === 'minimum_charge')?.amount, 100); });
test('discount and subsidy cannot reduce charge below zero', () => { const result = calculateBill(input(110), { ...tariff, tax_rate: 0, tax_name: 'None', discount_rate: 0.1, subsidy_amount: 200 }, tiers); assert.equal(result.discounts, 150); assert.equal(result.totalAmount, 0); });
test('previous balance is included when enabled', () => { const result = calculateBill(input(100, { previousBalance: 80 }), { ...tariff, tax_rate: 0, tax_name: 'None' }, tiers); assert.equal(result.previousBalance, 80); assert.equal(result.totalAmount, 130); });
test('penalty applies only after grace period', () => { const before = calculateBill(input(100, { previousBalance: 100, previousBalanceAgeDays: 5 }), { ...tariff, tax_rate: 0, tax_name: 'None' }, tiers); const after = calculateBill(input(100, { previousBalance: 100, previousBalanceAgeDays: 6 }), { ...tariff, tax_rate: 0, tax_name: 'None' }, tiers); assert.equal(before.penalties, 0); assert.equal(after.penalties, 2); });
test('rollover consumption uses configured register value', () => { assert.equal(calculateConsumption(input(5, { previousReading: 995, condition: 'rollover' }), 1000), 10); });
test('replacement meter consumption starts at its initial reading', () => { assert.equal(calculateConsumption(input(12, { condition: 'replaced', replacementInitialReading: 2 }), 1000), 10); });
test('normal readings below previous reading are rejected', () => { assert.throws(() => calculateConsumption(input(99), 1000), /below the previous/); });
test('rounding modes are deterministic', () => { assert.equal(roundBillingValue(1.005, 2, 'half_up'), 1.01); assert.equal(roundBillingValue(1.005, 2, 'half_even'), 1); assert.equal(roundBillingValue(1.001, 2, 'up'), 1.01); assert.equal(roundBillingValue(1.009, 2, 'down'), 1); });
test('identical inputs produce identical invoice calculations', () => { const first = calculateBill(input(127, { previousBalance: 50, previousBalanceAgeDays: 10 }), tariff, tiers); const second = calculateBill(input(127, { previousBalance: 50, previousBalanceAgeDays: 10 }), tariff, tiers); assert.deepEqual(first, second); });

const membershipTiers: BillingTier[] = [
  { id: 'membership-1', tariff_id: tariff.id, minimum_volume: 0, maximum_volume: 10, rate_per_unit: 0, sort_order: 1, created_at: '', updated_at: '' },
  { id: 'membership-2', tariff_id: tariff.id, minimum_volume: 10, maximum_volume: null, rate_per_unit: 15, sort_order: 2, created_at: '', updated_at: '' },
];
const membershipTariff = (customerType: 'member' | 'non_member'): BillingTariff => ({
  ...tariff,
  code: customerType === 'member' ? 'MEMBER_RESIDENTIAL' : 'NON_MEMBER_RESIDENTIAL',
  customer_type: customerType,
  fixed_charge: customerType === 'member' ? 150 : 200,
  minimum_charge: customerType === 'member' ? 150 : 200,
  tax_name: 'None',
  tax_rate: 0,
  penalty_rate: 0,
  apply_previous_balance: false,
});

test('member tariff charges ₱150 through 10 m³ and ₱15 for each excess m³', () => {
  const member = membershipTariff('member');
  assert.deepEqual([0, 5, 10, 11, 15].map((usage) => calculateBill(input(100 + usage), member, membershipTiers).totalAmount), [150, 150, 150, 165, 225]);
  assert.deepEqual(calculateBill(input(105), member, membershipTiers).items.map(({ description, amount }) => ({ description, amount })), [
    { description: 'Member minimum (0-10 m3)', amount: 150 },
  ]);
  assert.deepEqual(calculateBill(input(111), member, membershipTiers).items.map(({ description, quantity, unit_price, amount }) => ({ description, quantity, unit_price, amount })), [
    { description: 'Member minimum (0-10 m3)', quantity: 1, unit_price: 150, amount: 150 },
    { description: 'Additional 1 m3 x PHP 15.00', quantity: 1, unit_price: 15, amount: 15 },
  ]);
});

test('non-member tariff charges ₱200 through 10 m³ and ₱15 for each excess m³', () => {
  const nonMember = membershipTariff('non_member');
  assert.deepEqual([0, 5, 10, 11, 15].map((usage) => calculateBill(input(100 + usage), nonMember, membershipTiers).totalAmount), [200, 200, 200, 215, 275]);
  assert.deepEqual(calculateBill(input(115), nonMember, membershipTiers).items.map(({ description, amount }) => ({ description, amount })), [
    { description: 'Non-member minimum (0-10 m3)', amount: 200 },
    { description: 'Additional 5 m3 x PHP 15.00', amount: 75 },
  ]);
});

