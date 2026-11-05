export type MeterScanMatch = { customerId: string; meterId: string };

export function buildMeterScanDestination(match: MeterScanMatch) {
  return {
    pathname: '/customers/[id]' as const,
    params: { id: match.customerId, scannedMeterId: match.meterId },
  };
}

export function scannedMeterMatchesActiveAssignment(scannedMeterId: string | undefined, activeMeterId: string | undefined) {
  return !scannedMeterId || scannedMeterId === activeMeterId;
}
