import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePhase7Acceptance, PHASE7_SCENARIOS, validatePhase7Acceptance, type Phase7AcceptanceRecord } from '../src/lib/phase7Acceptance.ts';

const records: Phase7AcceptanceRecord[] = PHASE7_SCENARIOS.map((scenario) => ({ scenario, passed: true, testedAt: '2026-11-04T00:00:00Z', device: 'Android test device', evidence: `${scenario}.png` }));

test('requires passing evidence for every Phase 7 physical recovery scenario', () => {
  const result = evaluatePhase7Acceptance(records);
  assert.equal(result.complete, true);
  assert.equal(result.passedCount, 7);
  assert.deepEqual(result.validationErrors, []);
});

test('rejects missing, duplicate, and evidence-free acceptance records', () => {
  const errors = validatePhase7Acceptance([{ ...records[0], evidence: '' }, records[0]]);
  assert.ok(errors.some((error) => error.includes('evidence is required')));
  assert.ok(errors.some((error) => error.includes('duplicate scenario')));
  assert.ok(errors.some((error) => error.includes('Missing scenario')));
});
