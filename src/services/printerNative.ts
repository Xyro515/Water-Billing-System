import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type ReceiptPrinterModule = typeof import('react-native-receipt-printer');

let modulePromise: Promise<ReceiptPrinterModule> | null = null;

export async function loadReceiptPrinterModule() {
  if (Platform.OS === 'web' || Constants.expoVersion !== null) {
    throw new Error('development_build_required');
  }
  modulePromise ??= import('react-native-receipt-printer');
  try {
    return await modulePromise;
  } catch (error) {
    modulePromise = null;
    throw error;
  }
}
