import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMeterScanDestination, scannedMeterMatchesActiveAssignment } from '../src/lib/meterScan.ts';

test('QR resolution opens the matched customer and preserves the scanned meter ID', () => {
  assert.deepEqual(buildMeterScanDestination({ customerId: 'customer-1', meterId: 'meter-1' }), {
    pathname: '/customers/[id]',
    params: { id: 'customer-1', scannedMeterId: 'meter-1' },
  });
});

test('customer details accept only the currently active scanned meter', () => {
  assert.equal(scannedMeterMatchesActiveAssignment('meter-1', 'meter-1'), true);
  assert.equal(scannedMeterMatchesActiveAssignment('meter-old', 'meter-1'), false);
  assert.equal(scannedMeterMatchesActiveAssignment(undefined, 'meter-1'), true);
});
