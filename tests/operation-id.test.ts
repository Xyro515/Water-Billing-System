import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationId } from '../src/lib/operationId.ts';

test('creates unique UUID v4 operation identifiers for idempotent writes', () => {
  const ids = Array.from({ length: 100 }, createOperationId);
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, uuidV4);
});
