import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluatePhase7Acceptance } from '../src/lib/phase7Acceptance.ts';

const manifestPath = resolve(process.env.PHASE7_MANIFEST ?? 'tests/fixtures/phase7/manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`Phase 7 evidence manifest not found: ${manifestPath}`);
  console.error('Run `npm.cmd run phase7:setup` to create a blank evidence manifest, then complete it from physical-device testing.');
  process.exit(2);
}
const records = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(records)) throw new Error('Phase 7 manifest must contain a JSON array.');
const pending = records.filter((record) => record?.passed !== true);
if (pending.length) {
  for (const record of pending) console.log(`PENDING ${record?.scenario ?? 'unknown_scenario'}`);
  console.log(`Phase 7 physical-device acceptance is incomplete: ${records.length - pending.length}/${records.length} scenarios marked passed.`);
  console.log(`Complete the device, testedAt, evidence, and notes fields in ${manifestPath}, then set passed to true only after each physical test succeeds.`);
  process.exit(2);
}
const result = evaluatePhase7Acceptance(records);
for (const error of result.validationErrors) console.error(`FAIL ${error}`);
console.log(`Passed scenarios: ${result.passedCount}/${result.totalCount}`);
if (!result.complete) process.exit(1);
console.log('Phase 7 physical-device acceptance passed.');
