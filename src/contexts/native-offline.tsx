import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useAuth } from './auth';
import { OfflineContext } from './offline-context';
import { cacheApprovedTariffs, getFailedSyncCount, getPendingSyncCount, initializeOfflineDatabase } from '../services/offline-database';
import { synchronizePendingOperations } from '../services/synchronization';
import { supabase } from '../lib/supabase';

export function NativeOfflineProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const network = useNetworkState();
  const [ready, setReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastSynchronizedAt, setLastSynchronizedAt] = useState<string | null>(null);
  const online = network.isConnected !== false && network.isInternetReachable !== false;
  const ownerId = session?.user.id;

  const refreshPendingCount = useCallback(async () => {
    if (!ownerId) { setPendingCount(0); setFailedCount(0); return; }
    const [pending, failed] = await Promise.all([getPendingSyncCount(ownerId), getFailedSyncCount(ownerId)]);
    setPendingCount(pending);
    setFailedCount(failed);
  }, [ownerId]);

  const synchronize = useCallback(async (retryNow = false) => {
    if (!ownerId || !online) return;
    await synchronizePendingOperations(ownerId, retryNow);
    setLastSynchronizedAt(new Date().toISOString());
    await refreshPendingCount();
  }, [online, ownerId, refreshPendingCount]);

  const refreshTariffs = useCallback(async () => {
    if (!ownerId || !online) return;
    const [tariffs, tiers] = await Promise.all([
      supabase.from('tariffs').select('*').eq('is_approved', true),
      supabase.from('tariff_tiers').select('*'),
    ]);
    if (!tariffs.error && !tiers.error) await cacheApprovedTariffs(ownerId, tariffs.data, tiers.data);
  }, [online, ownerId]);

  useEffect(() => {
    let active = true;
    void initializeOfflineDatabase().then(() => { if (active) setReady(true); }).catch(() => { if (active) setReady(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (!ready) return; const timer = setTimeout(() => void refreshPendingCount(), 0); return () => clearTimeout(timer); }, [ready, refreshPendingCount]);
  useEffect(() => { if (!ready || !online || !ownerId) return; const timer = setTimeout(() => { void synchronize(); void refreshTariffs(); }, 0); return () => clearTimeout(timer); }, [online, ownerId, ready, refreshTariffs, synchronize]);
  useEffect(() => { const subscription = AppState.addEventListener('change', (state) => { if (state === 'active' && online) void synchronize(); }); return () => subscription.remove(); }, [online, synchronize]);

  const value = useMemo(() => ({ ready, online, pendingCount, failedCount, lastSynchronizedAt, synchronize, refreshPendingCount }), [failedCount, lastSynchronizedAt, online, pendingCount, ready, refreshPendingCount, synchronize]);
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}
