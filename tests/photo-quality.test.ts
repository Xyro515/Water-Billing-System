import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeRgbaPhotoQuality } from '../src/lib/photoQuality.ts';

function image(width: number, height: number, valueAt: (x: number, y: number) => number) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const value = valueAt(x, y); const offset = (y * width + x) * 4;
    data[offset] = value; data[offset + 1] = value; data[offset + 2] = value; data[offset + 3] = 255;
  }
  return data;
}

test('detects glare and a featureless blurred image', () => {
  const result = analyzeRgbaPhotoQuality(image(20, 20, () => 255), 20, 20);
  assert.ok(result.issues.includes('glare'));
  assert.ok(result.issues.includes('blur'));
});

test('detects low light', () => {
  const result = analyzeRgbaPhotoQuality(image(20, 20, () => 20), 20, 20);
  assert.ok(result.issues.includes('low_light'));
});

test('accepts a well-lit image with strong digit-like edges', () => {
  const result = analyzeRgbaPhotoQuality(image(20, 20, (x) => x % 4 < 2 ? 65 : 190), 20, 20);
  assert.deepEqual(result.issues, []);
  assert.ok(result.laplacianVariance > 80);
});

test('rejects malformed pixel input', () => {
  assert.throws(() => analyzeRgbaPhotoQuality(new Uint8Array(4), 20, 20), /Invalid image pixel data/);
});
