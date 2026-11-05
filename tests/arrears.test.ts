import assert from 'node:assert/strict';
import test from 'node:test';
import { allocatePaymentOldestFirst } from '../src/lib/arrears.ts';

const bills = [
  { id: 'new', dueDate: '2026-11-20', balance: 150 },
  { id: 'old', dueDate: '2026-10-20', balance: 300 },
];

test('allocates partial payments to the oldest bill first', () => {
  assert.deepEqual(allocatePaymentOldestFirst(bills, 200), { allocations: [{ billId: 'old', amount: 200 }], outstanding: 450, remainingBalance: 250 });
});

test('spans multiple bills without duplicating arrears', () => {
  assert.deepEqual(allocatePaymentOldestFirst(bills, 400).allocations, [{ billId: 'old', amount: 300 }, { billId: 'new', amount: 100 }]);
});

test('supports an exact full payment', () => {
  assert.equal(allocatePaymentOldestFirst(bills, 450).remainingBalance, 0);
});

test('rejects zero and overpayments', () => {
  assert.throws(() => allocatePaymentOldestFirst(bills, 0), /greater than zero/);
  assert.throws(() => allocatePaymentOldestFirst(bills, 451), /exceeds/);
});
