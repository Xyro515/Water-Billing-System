import { runtimeStorage as Storage } from './runtimeStorage';

const keys = { readingDraft: (customerId: string) => `nmmpc.reading-draft.${customerId}`, printerPreferences: 'nmmpc.printer-preferences', printedReceipt: (receiptId: string) => `nmmpc.printed-receipt.${receiptId}` };
export type ReadingDraft = { customerId: string; currentReading: string; fractionalDigits?: string; meterCondition: 'normal' | 'rollover' | 'replaced' | 'unreadable'; capturedAt: string; employeeId: string; meterId?: string; photoId?: string; photoUri?: string; photoPath?: string };
export type SavedPrinter = { address: string; name: string };
export type PrinterMode = 'bluetooth' | 'virtual';
export type PrinterPreferences = { paperWidth: 58 | 80; autoPrint: boolean; printerMode?: PrinterMode; virtualPrinterUrl?: string; savedPrinter?: SavedPrinter };
export type PrintedReceiptRecord = { printCount: number; lastPrintedAt: string };

async function getJson<T>(key: string): Promise<T | null> { const value = await Storage.getItem(key); if (!value) return null; try { return JSON.parse(value) as T; } catch { return null; } }

export const appStorage = {
  saveReadingDraft: (draft: ReadingDraft) => Storage.setItem(keys.readingDraft(draft.customerId), JSON.stringify(draft)),
  getReadingDraft: (customerId: string) => getJson<ReadingDraft>(keys.readingDraft(customerId)),
  removeReadingDraft: (customerId: string) => Storage.removeItem(keys.readingDraft(customerId)),
  savePrinterPreferences: (preferences: PrinterPreferences) => Storage.setItem(keys.printerPreferences, JSON.stringify(preferences)),
  getPrinterPreferences: () => getJson<PrinterPreferences>(keys.printerPreferences),
  getPrintedReceipt: (receiptId: string) => getJson<PrintedReceiptRecord>(keys.printedReceipt(receiptId)),
  recordPrintedReceipt: async (receiptId: string) => {
    const current = await getJson<PrintedReceiptRecord>(keys.printedReceipt(receiptId));
    const next = { printCount: (current?.printCount ?? 0) + 1, lastPrintedAt: new Date().toISOString() };
    await Storage.setItem(keys.printedReceipt(receiptId), JSON.stringify(next));
    return next;
  },
};
