export type SyncFailureKind = 'transient' | 'permanent';

export function syncFailureMessage(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  if (reason && typeof reason === 'object') {
    const error = reason as Record<string, unknown>;
    return [error.message, error.code, error.details, error.hint, error.status]
      .filter((value) => value !== undefined && value !== null)
      .map(String)
      .join(' | ') || 'Unknown synchronization failure';
  }
  return String(reason);
}

export function classifySyncFailure(message: string): SyncFailureKind {
  if (/network|fetch|timeout|timed out|connection|temporar|offline|408|425|429|500|502|503|504/i.test(message)) return 'transient';
  return 'permanent';
}

export function retryDelaySeconds(retryCount: number) {
  return Math.min(3600, 2 ** Math.min(Math.max(retryCount, 1), 10) * 5);
}

export function nextRetryAt(retryCount: number, now = Date.now()) {
  return new Date(now + retryDelaySeconds(retryCount) * 1000).toISOString();
}

export const syncConflictRules = {
  serverAuthoritative: ['customer', 'meter', 'meter_assignment', 'approved_tariff'],
  clientAppendOnly: ['meter_reading', 'invoice', 'meter_photo'],
  permanentConflictPatterns: ['duplicate billing period', 'unique constraint', 'authorization', 'validation'],
} as const;
