import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTestReceipt, buildWaterBillReceipt, type WaterBillReceipt } from '../src/lib/receipt.ts';

const invoice: WaterBillReceipt = {
  invoiceNumber: 'NMMPC-202611-00000001', issuedAt: '2026-11-02', billingPeriod: '2026-10-01 to 2026-10-31', dueDate: '2026-11-15',
  customerName: 'Demo Member', accountNumber: 'DEMO-0001', serviceAddress: 'Demo Address', meterNumber: 'METER-001',
  previousReading: 100, currentReading: 112.5, consumption: 12.5,
  charges: [{ description: 'Water usage', amount: 331.25 }, { description: 'Fixed service charge', amount: 85 }], currentCharges: 416.25, previousBalance: 100, totalAmount: 516.25, status: 'finalized',
};

for (const width of [58, 80] as const) {
  test(`builds a complete ${width} mm invoice receipt`, () => {
    const receipt = buildWaterBillReceipt(invoice, width);
    assert.equal(receipt.paperWidth, width);
    const serialized = JSON.stringify(receipt.lines);
    for (const value of ['NMMPC', invoice.invoiceNumber, invoice.customerName, invoice.accountNumber, invoice.serviceAddress, invoice.meterNumber, 'Previous:', 'Current:', 'Consumption:', 'Water usage', 'Fixed service charge', 'Current bill:', 'Previous balance:', 'PHP 100.00', 'AMOUNT DUE', invoice.dueDate]) assert.match(serialized, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(receipt.lines.at(-1)?.type, 'cut');
  });
}

test('marks preview receipts so they cannot be mistaken for final bills', () => {
  const receipt = buildWaterBillReceipt({ ...invoice, preview: true }, 58);
  assert.match(JSON.stringify(receipt.lines), /PREVIEW - NOT A FINAL BILL/);
});

test('marks provisional statements so they cannot be mistaken for final bills', () => {
  const receipt = buildWaterBillReceipt({ ...invoice, preview: false, provisional: true, status: 'provisional' }, 58);
  assert.match(JSON.stringify(receipt.lines), /PROVISIONAL - NOT A FINAL BILL/);
  assert.doesNotMatch(JSON.stringify(receipt.lines), /PREVIEW - NOT A FINAL BILL/);
});

test('builds test receipts for both supported widths', () => {
  assert.equal(buildTestReceipt(58).paperWidth, 58);
  assert.equal(buildTestReceipt(80).paperWidth, 80);
  assert.match(JSON.stringify(buildTestReceipt(58).lines), /NMMPC-TEST/);
});
