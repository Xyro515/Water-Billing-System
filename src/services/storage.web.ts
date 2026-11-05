import type { PrintedReceiptRecord, PrinterPreferences, ReadingDraft } from './storage';

const keys = { readingDraft: (customerId: string) => `nmmpc.reading-draft.${customerId}`, printerPreferences: 'nmmpc.printer-preferences', printedReceipt: (receiptId: string) => `nmmpc.printed-receipt.${receiptId}` };

function getJson<T>(key: string): T | null { const value = globalThis.localStorage?.getItem(key); if (!value) return null; try { return JSON.parse(value) as T; } catch { return null; } }

export const appStorage = {
  saveReadingDraft: async (draft: ReadingDraft) => { globalThis.localStorage?.setItem(keys.readingDraft(draft.customerId), JSON.stringify(draft)); },
  getReadingDraft: async (customerId: string) => getJson<ReadingDraft>(keys.readingDraft(customerId)),
  removeReadingDraft: async (customerId: string) => { globalThis.localStorage?.removeItem(keys.readingDraft(customerId)); },
  savePrinterPreferences: async (preferences: PrinterPreferences) => { globalThis.localStorage?.setItem(keys.printerPreferences, JSON.stringify(preferences)); },
  getPrinterPreferences: async () => getJson<PrinterPreferences>(keys.printerPreferences),
  getPrintedReceipt: async (receiptId: string) => getJson<PrintedReceiptRecord>(keys.printedReceipt(receiptId)),
  recordPrintedReceipt: async (receiptId: string) => {
    const current = getJson<PrintedReceiptRecord>(keys.printedReceipt(receiptId));
    const next = { printCount: (current?.printCount ?? 0) + 1, lastPrintedAt: new Date().toISOString() };
    globalThis.localStorage?.setItem(keys.printedReceipt(receiptId), JSON.stringify(next));
    return next;
  },
};
