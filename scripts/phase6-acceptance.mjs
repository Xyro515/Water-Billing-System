import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { evaluateOcrAcceptance, validateAcceptanceRecords } from '../src/lib/phase6Acceptance.ts';

const manifestPath = resolve(process.env.PHASE6_DATASET ?? 'tests/fixtures/meter-photos/manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`Phase 6 dataset not found: ${manifestPath}`);
  console.error('Copy manifest.example.json to manifest.json, add real meter photos, and record the OCR and employee-confirmation results.');
  process.exit(2);
}

const records = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(records)) throw new Error('Phase 6 manifest must contain a JSON array.');
const validationErrors = validateAcceptanceRecords(records);
for (const [index, record] of records.entries()) {
  const imagePath = resolve(dirname(manifestPath), record.image);
  if (!existsSync(imagePath)) validationErrors.push(`Row ${index + 1}: image file not found: ${imagePath}`);
}
if (validationErrors.length) {
  for (const error of validationErrors) console.error(`FAIL ${error}`);
  process.exit(1);
}

const result = evaluateOcrAcceptance(records);
console.log(`Photos: ${result.totalPhotos}`);
console.log(`Recognition rate: ${(result.recognitionRate * 100).toFixed(2)}%`);
console.log(`Exact-match OCR accuracy: ${(result.exactMatchAccuracy * 100).toFixed(2)}%`);
console.log(`Manual-correction verification: ${(result.manualCorrectionRate * 100).toFixed(2)}%`);
console.log(`Meter models: ${result.meterModelCount}`);
console.log(`Required-condition coverage: ${result.missingConditions.length ? `missing ${result.missingConditions.join(', ')}` : 'complete'}`);

if (!result.totalPhotos || !result.coverageComplete || !result.everyResultCorrectable) {
  console.error('Phase 6 acceptance evidence is incomplete.');
  process.exit(1);
}
console.log('Phase 6 dataset coverage and manual-correction acceptance passed.');
