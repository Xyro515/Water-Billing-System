import { createContext } from 'react';

export type OfflineContextValue = {
  ready: boolean;
  online: boolean;
  pendingCount: number;
  failedCount: number;
  lastSynchronizedAt: string | null;
  synchronize: (retryNow?: boolean) => Promise<void>;
  refreshPendingCount: () => Promise<void>;
};

export const OfflineContext = createContext<OfflineContextValue | null>(null);
