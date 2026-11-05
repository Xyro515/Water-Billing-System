import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateOcrAcceptance, validateAcceptanceRecords, type OcrAcceptanceRecord } from '../src/lib/phase6Acceptance.ts';

const records: OcrAcceptanceRecord[] = [
  { id: 'sun', image: 'sun.jpg', meterModel: 'Model A', condition: 'bright_sunlight', expectedWholeReading: 100, expectedFractionalDigits: '2', ocrWholeReading: 100, ocrFractionalDigits: '2', employeeConfirmedReading: 100, manualCorrectionVerified: true },
  { id: 'low', image: 'low.jpg', meterModel: 'Model A', condition: 'low_light', expectedWholeReading: 200, expectedFractionalDigits: '', ocrWholeReading: 208, ocrFractionalDigits: '', employeeConfirmedReading: 200, manualCorrectionVerified: true },
  { id: 'glare', image: 'glare.jpg', meterModel: 'Model B', condition: 'glare', expectedWholeReading: 300, expectedFractionalDigits: '7', ocrWholeReading: null, ocrFractionalDigits: null, employeeConfirmedReading: 300, manualCorrectionVerified: true },
  { id: 'dirty', image: 'dirty.jpg', meterModel: 'Model B', condition: 'dirty_or_scratched', expectedWholeReading: 400, expectedFractionalDigits: '', ocrWholeReading: 400, ocrFractionalDigits: '', employeeConfirmedReading: 400, manualCorrectionVerified: true },
];

test('reports OCR accuracy, recognition, coverage, and correction independently', () => {
  const result = evaluateOcrAcceptance(records);
  assert.equal(result.recognitionRate, 0.75);
  assert.equal(result.exactMatchAccuracy, 2 / 3);
  assert.equal(result.manualCorrectionRate, 1);
  assert.equal(result.coverageComplete, true);
  assert.equal(result.everyResultCorrectable, true);
});

test('rejects incomplete and duplicate dataset records', () => {
  const invalid = [{ ...records[0], id: '', image: '', meterModel: '', expectedWholeReading: -1, expectedFractionalDigits: 'x' }, records[0], records[0]];
  const errors = validateAcceptanceRecords(invalid);
  assert.ok(errors.some((error) => error.includes('id is required')));
  assert.ok(errors.some((error) => error.includes('duplicate id')));
  assert.ok(errors.some((error) => error.includes('digits only')));
});
