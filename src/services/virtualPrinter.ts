import type { ReceiptData } from 'react-native-receipt-printer';
import Constants from 'expo-constants';
import { runningInExpoGo } from './runtimeStorage';

export function isExpoGo() {
  return runningInExpoGo;
}

export function getDefaultVirtualPrinterUrl() {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host && host !== 'localhost' ? `http://${host}:9101` : 'http://127.0.0.1:9101';
}

export function normalizeVirtualPrinterUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export async function sendToVirtualPrinter(receipt: ReceiptData, baseUrl: string) {
  const url = normalizeVirtualPrinterUrl(baseUrl);
  if (!/^https?:\/\//i.test(url)) throw new Error('Virtual printer URL must start with http:// or https://.');
  const response = await fetch(`${url}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receipt, source: 'nmmpc-expo-go', sentAt: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`Virtual printer returned HTTP ${response.status}.`);
  return response.json() as Promise<{ id: string; output: string }>;
}
