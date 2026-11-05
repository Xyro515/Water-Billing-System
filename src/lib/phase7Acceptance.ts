export const PHASE7_SCENARIOS = [
  'airplane_mode_reading',
  'restart_persistence',
  'reconnect_synchronization',
  'duplicate_retry_prevention',
  'conflict_resolution',
  'forced_termination_recovery',
  'partial_photo_upload_recovery',
] as const;

export type Phase7Scenario = typeof PHASE7_SCENARIOS[number];
export type Phase7AcceptanceRecord = { scenario: Phase7Scenario; passed: boolean; testedAt: string; device: string; evidence: string; notes?: string };

export function validatePhase7Acceptance(records: Phase7AcceptanceRecord[]) {
  const errors: string[] = []; const seen = new Set<string>();
  records.forEach((record, index) => {
    const label = `Row ${index + 1}`;
    if (!PHASE7_SCENARIOS.includes(record.scenario)) errors.push(`${label}: unknown scenario.`);
    if (seen.has(record.scenario)) errors.push(`${label}: duplicate scenario ${record.scenario}.`);
    seen.add(record.scenario);
    if (!record.device?.trim()) errors.push(`${label}: device is required.`);
    if (!record.evidence?.trim()) errors.push(`${label}: evidence is required.`);
    if (!record.testedAt || Number.isNaN(Date.parse(record.testedAt))) errors.push(`${label}: valid testedAt is required.`);
  });
  for (const scenario of PHASE7_SCENARIOS) if (!seen.has(scenario)) errors.push(`Missing scenario: ${scenario}.`);
  return errors;
}

export function evaluatePhase7Acceptance(records: Phase7AcceptanceRecord[]) {
  const validationErrors = validatePhase7Acceptance(records);
  const passed = new Set(records.filter((record) => record.passed).map((record) => record.scenario));
  return { validationErrors, passedCount: PHASE7_SCENARIOS.filter((scenario) => passed.has(scenario)).length, totalCount: PHASE7_SCENARIOS.length, complete: validationErrors.length === 0 && PHASE7_SCENARIOS.every((scenario) => passed.has(scenario)) };
}
