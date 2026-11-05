import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySyncFailure, nextRetryAt, retryDelaySeconds, syncConflictRules, syncFailureMessage } from '../src/lib/syncPolicy.ts';

test('classifies retryable connection and service failures as transient', () => {
  for (const message of ['Network request failed', 'request timed out', 'HTTP 429', 'service returned 503']) {
    assert.equal(classifySyncFailure(message), 'transient');
  }
});

test('classifies validation, authorization, and uniqueness failures as permanent', () => {
  for (const message of ['validation failed', 'authorization denied', 'unique constraint violation']) {
    assert.equal(classifySyncFailure(message), 'permanent');
  }
});

test('preserves structured service error details for retry classification and review', () => {
  assert.equal(syncFailureMessage({ message: 'Service unavailable', code: '503', details: 'gateway timeout' }), 'Service unavailable | 503 | gateway timeout');
  assert.equal(classifySyncFailure(syncFailureMessage({ message: 'Service unavailable', code: '503' })), 'transient');
});

test('uses capped exponential retry delays', () => {
  assert.equal(retryDelaySeconds(1), 10);
  assert.equal(retryDelaySeconds(2), 20);
  assert.equal(retryDelaySeconds(9), 2560);
  assert.equal(retryDelaySeconds(10), 3600);
  assert.equal(retryDelaySeconds(99), 3600);
  assert.equal(nextRetryAt(1, Date.parse('2026-11-04T00:00:00.000Z')), '2026-11-04T00:00:10.000Z');
});

test('documents server-authoritative and append-only conflict groups', () => {
  assert.ok(syncConflictRules.serverAuthoritative.includes('customer'));
  assert.ok(syncConflictRules.serverAuthoritative.includes('approved_tariff'));
  assert.ok(syncConflictRules.clientAppendOnly.includes('meter_reading'));
  assert.ok(syncConflictRules.clientAppendOnly.includes('invoice'));
  assert.ok(syncConflictRules.permanentConflictPatterns.includes('unique constraint'));
});
