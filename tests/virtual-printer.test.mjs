import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeEscPos, formatReceipt } from '../tools/virtual-printer/escpos.mjs';

test('virtual printer emits a centered Code 128 ESC/POS barcode', () => {
  const output = encodeEscPos({
    paperWidth: 58,
    lines: [{ type: 'barcode', data: 'NMMPC-TEST', height: 64, showText: true }],
  });

  assert.equal(output.indexOf(Buffer.from('[BARCODE')), -1);
  assert.notEqual(output.indexOf(Buffer.from([0x1d, 0x68, 64])), -1, 'sets barcode height');
  assert.notEqual(output.indexOf(Buffer.from([0x1d, 0x77, 2])), -1, 'sets a scannable module width');
  assert.notEqual(output.indexOf(Buffer.from([0x1d, 0x48, 2])), -1, 'prints human-readable text below the bars');
  assert.notEqual(output.indexOf(Buffer.from([0x1d, 0x6b, 73, 10])), -1, 'uses GS k Code 128 with the correct payload length');
  assert.notEqual(output.indexOf(Buffer.from('NMMPC-TEST', 'ascii')), -1, 'contains the exact customer-visible value');
  assert.equal(output.indexOf(Buffer.from('{BNMMPC-TEST', 'ascii')), -1, 'does not expose the hardware code-set selector in CrossEscPos');
  assert.match(formatReceipt({ paperWidth: 58, lines: [{ type: 'barcode', data: 'NMMPC-TEST' }] }), /\[CODE128 NMMPC-TEST\]/);
});

test('virtual printer preserves line feeds instead of replacing them with question marks', () => {
  const output = encodeEscPos({
    paperWidth: 58,
    lines: [
      { type: 'text', content: 'FIRST' },
      { type: 'divider' },
      { type: 'text', content: 'SECOND' },
    ],
  });
  assert.notEqual(output.indexOf(Buffer.from(`FIRST${' '.repeat(27)}\n`, 'ascii')), -1);
  assert.notEqual(output.indexOf(Buffer.from('-'.repeat(32) + '\n', 'ascii')), -1);
  assert.notEqual(output.indexOf(Buffer.from(`SECOND${' '.repeat(26)}\n`, 'ascii')), -1);
});

test('virtual printer aligns columns and wraps long values within the selected paper width', () => {
  const formatted = formatReceipt({
    paperWidth: 58,
    lines: [
      { type: 'text', preText: 'Due:', content: '2026-11-17' },
      { type: 'text', preText: 'Invoice:', content: 'PREVIEW-DEMO-MEMBER-0001' },
      { type: 'text', content: 'PHP 165.00', align: 'center', size: 'large' },
    ],
  }).split('\n');

  assert.equal(formatted[0].length, 32);
  assert.equal(formatted[0].slice(-10), '2026-11-17');
  assert.equal(formatted[1].length, 32);
  assert.equal(formatted[1].trimEnd(), 'Invoice:');
  assert.equal(formatted[2].length, 32);
  assert.equal(formatted[2].trim(), 'PREVIEW-DEMO-MEMBER-0001');
  assert.equal(formatted[3].length, 16, 'large text uses the double-width character count');
  assert.equal(formatted[3].trim(), 'PHP 165.00');
});

test('virtual printer emits native ESC/POS QR commands', () => {
  const output = encodeEscPos({ paperWidth: 58, lines: [{ type: 'qrcode', data: 'NMMPC:TEST' }] });
  assert.notEqual(output.indexOf(Buffer.from([0x1d, 0x28, 0x6b, 3, 0, 49, 81, 48])), -1);
  assert.notEqual(output.indexOf(Buffer.from('NMMPC:TEST', 'ascii')), -1);
});
