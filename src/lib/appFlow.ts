import type { MeterCondition } from './meterRecognition';

export function getGreeting(hour: number) {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return 'Hello';
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localMonthStart(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function readingStartBlockReason(input: { customerStatus: string; hasActiveMeter: boolean; billingPeriodStart: string; billingPeriodEnd: string }) {
  if (input.customerStatus !== 'active') return 'This account must be active before recording a new reading.';
  if (!input.hasActiveMeter) return 'Assign an active meter before recording a reading.';
  if (!input.billingPeriodStart || !input.billingPeriodEnd || input.billingPeriodStart > input.billingPeriodEnd) return 'A reading already covers the current billing date. Choose another customer.';
  return null;
}

export function exceptionalReadingNeedsPhoto(condition: MeterCondition, hasPhoto: boolean) {
  return condition !== 'normal' && !hasPhoto;
}
