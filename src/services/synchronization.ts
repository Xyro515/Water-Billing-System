import { supabase } from '../lib/supabase';
import { getReadySyncOperations, makePendingSyncOperationsReady, markSyncComplete, markSyncFailed, markSyncProcessing, resetInterruptedSyncOperations, saveOfflineRecord, type SyncQueueItem } from './offline-database';
import { uploadMeterPhoto, type MeterPhotoRecord } from './meterPhotos';
import { classifySyncFailure, syncFailureMessage } from '../lib/syncPolicy';
import { finalizeProvisionalReceipt, isProvisionalInvoiceSyncPayload } from '../lib/offlineBilling';

export type SynchronizationSummary = { attempted: number; completed: number; deferred: number; permanentFailures: number };
const synchronizationPromises = new Map<string, Promise<SynchronizationSummary>>();

async function synchronizeItem(item: SyncQueueItem) {
  const payload = JSON.parse(item.payload) as Record<string, unknown>;
  if (item.entity_type === 'meter_photo') {
    const record = payload as unknown as MeterPhotoRecord;
    await uploadMeterPhoto(record);
    await saveOfflineRecord(item.owner_id, 'meter_photo', item.entity_id, { ...record, uploadStatus: 'uploaded' });
    return;
  }
  if (item.entity_type === 'invoice' && isProvisionalInvoiceSyncPayload(payload)) {
    const readingResult = await supabase.from('meter_readings').upsert(payload.reading, { onConflict: 'client_operation_id', ignoreDuplicates: true });
    if (readingResult.error) throw readingResult.error;
    const savedReading = await supabase.from('meter_readings').select('id').eq('client_operation_id', payload.reading.client_operation_id ?? '').maybeSingle();
    if (savedReading.error) throw savedReading.error;
    if (!savedReading.data) throw new Error('Temporary synchronization dependency: the meter reading is not available yet.');
    const invoiceResult = await supabase.rpc('create_invoice_atomic', { ...payload.invoice_request, p_meter_reading_id: savedReading.data.id });
    if (invoiceResult.error) throw invoiceResult.error;
    if (!invoiceResult.data) throw new Error('Temporary synchronization failure: the server invoice was not returned.');
    const finalReceipt = finalizeProvisionalReceipt(payload.receipt, invoiceResult.data);
    const { saveOfflineInvoiceReceipt } = await import('./offline-database');
    await saveOfflineInvoiceReceipt(item.owner_id, payload.customer_id, item.entity_id, invoiceResult.data.status, finalReceipt);
    await saveOfflineInvoiceReceipt(item.owner_id, payload.customer_id, invoiceResult.data.id, invoiceResult.data.status, finalReceipt);
    return;
  }
  const table = item.entity_type === 'meter_reading' ? 'meter_readings' : item.entity_type === 'invoice' ? 'invoices' : 'payments';
  const result = await supabase.from(table).upsert(payload as never, { onConflict: 'client_operation_id', ignoreDuplicates: true });
  if (result.error) throw result.error;
}

export async function synchronizePendingOperations(ownerId: string, retryNow = false) {
  const activeSynchronization = synchronizationPromises.get(ownerId);
  if (activeSynchronization) return activeSynchronization;
  const synchronizationPromise = (async () => {
    const summary: SynchronizationSummary = { attempted: 0, completed: 0, deferred: 0, permanentFailures: 0 };
    await resetInterruptedSyncOperations(ownerId);
    if (retryNow) await makePendingSyncOperationsReady(ownerId);
    while (true) {
      const items = await getReadySyncOperations(ownerId);
      if (items.length === 0) break;
      for (const item of items) {
        summary.attempted += 1;
        await markSyncProcessing(item.operation_id);
        try { await synchronizeItem(item); await markSyncComplete(item.operation_id); summary.completed += 1; }
        catch (reason) {
          const message = syncFailureMessage(reason);
          const permanent = classifySyncFailure(message) === 'permanent';
          await markSyncFailed(item, message, permanent);
          if (permanent) summary.permanentFailures += 1; else summary.deferred += 1;
        }
      }
    }
    return summary;
  })().finally(() => { synchronizationPromises.delete(ownerId); });
  synchronizationPromises.set(ownerId, synchronizationPromise);
  return synchronizationPromise;
}

