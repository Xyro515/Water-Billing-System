import { Directory, File, Paths } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { offlineDatabaseEnabled } from './runtimeStorage';

export type MeterPhotoRecord = {
  id: string;
  customerId: string;
  meterId: string;
  meterNumber: string;
  employeeId: string;
  localUri: string;
  capturedAt: string;
  mimeType: 'image/jpeg';
  remotePath: string;
  uploadStatus: 'pending' | 'uploaded';
};

function createPhotoId() {
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function persistMeterPhoto(input: {
  temporaryUri: string;
  ownerId: string;
  customerId: string;
  meterId: string;
  meterNumber: string;
  employeeId: string;
}) {
  const directory = new Directory(Paths.document, 'meter-photos');
  if (!directory.exists) directory.create({ idempotent: true, intermediates: true });

  // Retakes receive a new ID so the original photograph remains immutable for audits.
  const id = createPhotoId();
  const destination = new File(directory, `${id}.jpg`);
  if (destination.exists) destination.delete();
  await new File(input.temporaryUri).copy(destination);

  let record: MeterPhotoRecord = {
    id,
    customerId: input.customerId,
    meterId: input.meterId,
    meterNumber: input.meterNumber,
    employeeId: input.employeeId,
    localUri: destination.uri,
    capturedAt: new Date().toISOString(),
    mimeType: 'image/jpeg',
    remotePath: `${input.employeeId}/${input.customerId}/${id}.jpg`,
    uploadStatus: 'pending',
  };
  let operationId: string | undefined;
  if (offlineDatabaseEnabled) {
    const { saveAndQueueOfflineMutation } = await import('./offline-database');
    operationId = await saveAndQueueOfflineMutation(input.ownerId, 'meter_photo', id, record);
  }
  try {
    await uploadMeterPhoto(record);
    record = { ...record, uploadStatus: 'uploaded' };
    if (offlineDatabaseEnabled) {
      const { markSyncComplete, saveOfflineRecord } = await import('./offline-database');
      if (operationId) await markSyncComplete(operationId);
      await saveOfflineRecord(input.ownerId, 'meter_photo', id, record);
    }
  } catch {
    // The private local original and durable queue are retained for online retry.
  }
  return record;
}

export async function uploadMeterPhoto(record: MeterPhotoRecord) {
  const file = new File(record.localUri);
  if (!file.exists) throw new Error('The local meter photograph is missing.');
  const content = await file.arrayBuffer();
  const result = await supabase.storage.from('meter-photos').upload(record.remotePath, content, {
    contentType: record.mimeType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (result.error && !/already exists|duplicate/i.test(result.error.message)) throw result.error;
  return record.remotePath;
}
