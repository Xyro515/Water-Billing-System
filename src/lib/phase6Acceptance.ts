export const requiredPhotoConditions = ['bright_sunlight', 'low_light', 'glare', 'dirty_or_scratched'] as const;
export type PhotoCondition = typeof requiredPhotoConditions[number] | 'normal';

export type OcrAcceptanceRecord = {
  id: string;
  image: string;
  meterModel: string;
  condition: PhotoCondition;
  expectedWholeReading: number;
  expectedFractionalDigits: string;
  ocrWholeReading: number | null;
  ocrFractionalDigits: string | null;
  employeeConfirmedReading: number | null;
  manualCorrectionVerified: boolean;
};

export function evaluateOcrAcceptance(records: OcrAcceptanceRecord[]) {
  const recognized = records.filter((record) => record.ocrWholeReading !== null);
  const exactMatches = recognized.filter((record) => record.ocrWholeReading === record.expectedWholeReading && (record.ocrFractionalDigits ?? '') === record.expectedFractionalDigits);
  const manuallyCorrectable = records.filter((record) => record.manualCorrectionVerified && record.employeeConfirmedReading === record.expectedWholeReading);
  const coveredConditions = new Set(records.map((record) => record.condition));
  const missingConditions = requiredPhotoConditions.filter((condition) => !coveredConditions.has(condition));
  const meterModels = new Set(records.map((record) => record.meterModel.trim()).filter(Boolean));

  return {
    totalPhotos: records.length,
    recognizedPhotos: recognized.length,
    exactMatches: exactMatches.length,
    exactMatchAccuracy: recognized.length ? exactMatches.length / recognized.length : 0,
    recognitionRate: records.length ? recognized.length / records.length : 0,
    manualCorrectionRate: records.length ? manuallyCorrectable.length / records.length : 0,
    missingConditions,
    meterModelCount: meterModels.size,
    coverageComplete: missingConditions.length === 0 && meterModels.size >= 2,
    everyResultCorrectable: records.length > 0 && manuallyCorrectable.length === records.length,
  };
}

export function validateAcceptanceRecords(records: OcrAcceptanceRecord[]) {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const [index, record] of records.entries()) {
    if (!record.id.trim()) errors.push(`Row ${index + 1}: id is required.`);
    else if (ids.has(record.id)) errors.push(`Row ${index + 1}: duplicate id ${record.id}.`);
    ids.add(record.id);
    if (!record.image.trim()) errors.push(`Row ${index + 1}: image is required.`);
    if (!record.meterModel.trim()) errors.push(`Row ${index + 1}: meterModel is required.`);
    if (!Number.isSafeInteger(record.expectedWholeReading) || record.expectedWholeReading < 0) errors.push(`Row ${index + 1}: expectedWholeReading must be a non-negative integer.`);
    if (!/^\d*$/.test(record.expectedFractionalDigits)) errors.push(`Row ${index + 1}: expectedFractionalDigits must contain digits only.`);
  }
  return errors;
}
