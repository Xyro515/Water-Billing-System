import assert from 'node:assert/strict';
import test from 'node:test';
import { assessMeterReading, getMeterDigitCrop, parseMeterRecognition } from '../src/lib/meterRecognition.ts';
import { exceptionalReadingNeedsPhoto, getGreeting, localDateKey, localMonthStart, readingStartBlockReason } from '../src/lib/appFlow.ts';

test('guides the field workflow without reopening completed or exceptional readings unsafely', () => {
  assert.equal(getGreeting(7), 'Good morning');
  assert.equal(getGreeting(14), 'Good afternoon');
  assert.equal(getGreeting(21), 'Good evening');
  assert.match(readingStartBlockReason({ customerStatus: 'suspended', hasActiveMeter: true, billingPeriodStart: '2026-11-01', billingPeriodEnd: '2026-11-05' }) ?? '', /must be active/);
  assert.match(readingStartBlockReason({ customerStatus: 'active', hasActiveMeter: true, billingPeriodStart: '2026-11-06', billingPeriodEnd: '2026-11-05' }) ?? '', /already covers/);
  assert.equal(readingStartBlockReason({ customerStatus: 'active', hasActiveMeter: true, billingPeriodStart: '2026-11-01', billingPeriodEnd: '2026-11-05' }), null);
  assert.equal(exceptionalReadingNeedsPhoto('rollover', false), true);
  assert.equal(exceptionalReadingNeedsPhoto('normal', false), false);
  const localDate = new Date(2026, 10, 5, 23, 30);
  assert.equal(localDateKey(localDate), '2026-11-05');
  assert.equal(localMonthStart(localDate), '2026-11-01');
});

test('creates a bounded center crop for the meter digit guide', () => {
  assert.deepEqual(getMeterDigitCrop(4000, 3000), { originX: 560, originY: 1170, width: 2880, height: 660 });
  assert.throws(() => getMeterDigitCrop(0, 3000), /dimensions are invalid/);
});

test('separates explicit whole and fractional meter digits', () => {
  const result = parseMeterRecognition('00150.7');
  assert.equal(result?.wholeDigits, '00150');
  assert.equal(result?.fractionalDigits, '7');
  assert.equal(result?.reading, 150);
  assert.equal(result?.confidence, 'high');
});

test('marks ambiguous OCR substitutions for employee review', () => {
  const result = parseMeterRecognition('O015B');
  assert.equal(result?.reading, 158);
  assert.equal(result?.confidence, 'low');
  assert.ok(result?.issues.includes('character_substitution'));
});

test('never silently assumes an unmarked final digit is fractional', () => {
  const result = parseMeterRecognition('001507');
  assert.equal(result?.reading, 1507);
  assert.equal(result?.fractionalDigits, '');
  assert.equal(result?.confidence, 'review');
  assert.ok(result?.issues.includes('fractional_color_unverified'));
});

test('detects invalid, unusual, rollover, replacement, and unreadable readings', () => {
  assert.equal(assessMeterReading(120, 110, 'normal').belowPrevious, true);
  assert.equal(assessMeterReading(120, 160, 'normal').unusual, true);
  assert.equal(assessMeterReading(995, 5, 'rollover').consumption, 10);
  assert.equal(assessMeterReading(700, 12, 'replaced').consumption, 12);
  assert.equal(assessMeterReading(700, 0, 'unreadable').unreadable, true);
});
