import { lazy, PropsWithChildren, Suspense, useContext, useMemo } from 'react';
import { OfflineContext, type OfflineContextValue } from './offline-context';
import { offlineDatabaseEnabled } from '../services/runtimeStorage';

const NativeOfflineProvider = lazy(async () => {
  const module = await import('./native-offline');
  return { default: module.NativeOfflineProvider };
});

export function OfflineProvider({ children }: PropsWithChildren) {
  if (!offlineDatabaseEnabled) return <ExpoGoOnlineProvider>{children}</ExpoGoOnlineProvider>;
  return <Suspense fallback={<OfflineLoadingProvider>{children}</OfflineLoadingProvider>}><NativeOfflineProvider>{children}</NativeOfflineProvider></Suspense>;
}

function ExpoGoOnlineProvider({ children }: PropsWithChildren) {
  const value = useMemo<OfflineContextValue>(() => ({ ready: true, online: true, pendingCount: 0, failedCount: 0, lastSynchronizedAt: null, synchronize: async () => undefined, refreshPendingCount: async () => undefined }), []);
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

function OfflineLoadingProvider({ children }: PropsWithChildren) {
  const value = useMemo<OfflineContextValue>(() => ({ ready: false, online: false, pendingCount: 0, failedCount: 0, lastSynchronizedAt: null, synchronize: async () => undefined, refreshPendingCount: async () => undefined }), []);
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() { const context = useContext(OfflineContext); if (!context) throw new Error('useOffline must be used inside OfflineProvider.'); return context; }

