import assert from 'node:assert/strict';
import test from 'node:test';
import { isTerminalSessionError } from '../src/lib/sessionErrors.ts';

test('revoked and missing refresh tokens require a return to login', () => {
  assert.equal(isTerminalSessionError({ code: 'refresh_token_already_used' }), true);
  assert.equal(isTerminalSessionError({ code: 'refresh_token_not_found' }), true);
  assert.equal(isTerminalSessionError({ name: 'AuthSessionMissingError' }), true);
  assert.equal(isTerminalSessionError({ status: 401 }), true);
});

test('temporary network and service failures preserve the local session', () => {
  assert.equal(isTerminalSessionError(new TypeError('Network request failed')), false);
  assert.equal(isTerminalSessionError({ status: 503, message: 'Service unavailable' }), false);
  assert.equal(isTerminalSessionError({ code: 'request_timeout' }), false);
});
