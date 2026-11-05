import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const manifestPath = resolve(process.env.PHASE7_MANIFEST ?? 'tests/fixtures/phase7/manifest.json');
const examplePath = resolve('tests/fixtures/phase7/manifest.example.json');

if (existsSync(manifestPath)) {
  console.log(`Phase 7 evidence manifest already exists: ${manifestPath}`);
  process.exit(0);
}
if (!existsSync(examplePath)) throw new Error(`Phase 7 manifest template not found: ${examplePath}`);
mkdirSync(dirname(manifestPath), { recursive: true });
copyFileSync(examplePath, manifestPath);
console.log(`Created blank Phase 7 evidence manifest: ${manifestPath}`);
console.log('Run the seven physical-device scenarios, then replace each blank field and set passed to true only when its evidence is recorded.');
