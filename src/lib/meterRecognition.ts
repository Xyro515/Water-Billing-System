export type RecognitionConfidence = 'high' | 'review' | 'low';
export type MeterCondition = 'normal' | 'rollover' | 'replaced' | 'unreadable';

export type MeterRecognitionSuggestion = {
  rawText: string;
  wholeDigits: string;
  fractionalDigits: string;
  reading: number;
  confidence: RecognitionConfidence;
  issues: ('character_substitution' | 'multiple_candidates' | 'fractional_color_unverified')[];
};

export type MeterDigitCrop = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export function getMeterDigitCrop(imageWidth: number, imageHeight: number): MeterDigitCrop {
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    throw new Error('The captured photo dimensions are invalid.');
  }

  // This mirrors the centered digit guide without modifying the source photo.
  const width = Math.max(1, Math.round(imageWidth * 0.72));
  const height = Math.max(1, Math.round(imageHeight * 0.22));
  return {
    originX: Math.max(0, Math.round((imageWidth - width) / 2)),
    originY: Math.max(0, Math.round((imageHeight - height) / 2)),
    width: Math.min(width, Math.round(imageWidth)),
    height: Math.min(height, Math.round(imageHeight)),
  };
}

export function parseMeterRecognition(rawText: string): MeterRecognitionSuggestion | null {
  const trimmed = rawText.trim().toUpperCase();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[O]/g, '0').replace(/[IL]/g, '1').replace(/[S]/g, '5').replace(/[B]/g, '8');
  const substitutions = normalized !== trimmed;
  const candidates = normalized.match(/\d+(?:[.,]\d+)?/g) ?? [];
  if (!candidates.length) return null;
  const candidate = [...candidates].sort((left, right) => right.replace(/\D/g, '').length - left.replace(/\D/g, '').length)[0];
  const [whole = '', fraction = ''] = candidate.replace(',', '.').split('.');
  if (!whole || !Number.isSafeInteger(Number(whole))) return null;
  const issues: MeterRecognitionSuggestion['issues'] = [];
  if (substitutions) issues.push('character_substitution');
  if (candidates.length > 1) issues.push('multiple_candidates');
  if (!fraction) issues.push('fractional_color_unverified');
  const confidence: RecognitionConfidence = substitutions || candidates.length > 1 ? 'low' : fraction ? 'high' : 'review';
  return { rawText, wholeDigits: whole, fractionalDigits: fraction, reading: Number(whole), confidence, issues };
}

export function calculateDraftConsumption(previous: number, current: number, condition: MeterCondition, rolloverValue = 1000) {
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous < 0 || current < 0) return null;
  if (condition === 'unreadable') return null;
  if (condition === 'replaced') return current;
  if (condition === 'rollover') {
    const consumption = rolloverValue + current - previous;
    return consumption >= 0 && consumption <= rolloverValue ? consumption : null;
  }
  return current >= previous ? current - previous : null;
}

export function assessMeterReading(previous: number, current: number, condition: MeterCondition, unusualThreshold = 30) {
  const consumption = calculateDraftConsumption(previous, current, condition);
  return {
    consumption,
    unreadable: condition === 'unreadable',
    belowPrevious: condition === 'normal' && Number.isFinite(current) && current < previous,
    unusual: consumption !== null && consumption > unusualThreshold,
    requiresConfirmation: condition !== 'normal' || consumption === null || consumption > unusualThreshold,
  };
}
