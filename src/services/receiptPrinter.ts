import type { PrintStatusEvent, ReceiptData } from 'react-native-receipt-printer';
import type { WaterBillReceipt } from '../lib/receipt';
import { supabase } from '../lib/supabase';
import type { Json } from '../types/database.types';
import { loadReceiptPrinterModule } from './printerNative';
import { sendToVirtualPrinter } from './virtualPrinter';
import { offlineDatabaseEnabled } from './runtimeStorage';

export type PrintProgress = PrintStatusEvent | { status: 'preparing' };
export type PrintReceiptOptions = {
  printerAddress?: string;
  virtualPrinterUrl?: string;
  onProgress?: (progress: PrintProgress) => void;
};
export type AuditedPrintOptions = PrintReceiptOptions & {
  invoiceId: string;
  isReprint: boolean;
  reprintReason?: string;
  printerName?: string;
};

export class DuplicatePrintError extends Error {
  constructor() {
    super('This invoice was already printed. A reprint reason is required.');
    this.name = 'DuplicatePrintError';
  }
}

async function loadInvoiceReceiptFromServer(invoiceId: string): Promise<WaterBillReceipt> {
  const invoiceResult = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
  if (invoiceResult.error) throw invoiceResult.error;
  const invoice = invoiceResult.data;
  const [customerResult, readingResult, itemResult] = await Promise.all([
    supabase.from('customers').select('*').eq('id', invoice.customer_id).single(),
    supabase.from('meter_readings').select('*').eq('id', invoice.meter_reading_id).single(),
    supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id).order('sort_order'),
  ]);
  if (customerResult.error) throw customerResult.error;
  if (readingResult.error) throw readingResult.error;
  if (itemResult.error) throw itemResult.error;
  const meterResult = await supabase.from('meters').select('*').eq('id', readingResult.data.meter_id).single();
  if (meterResult.error) throw meterResult.error;
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    issuedAt: invoice.issued_at,
    billingPeriod: `${invoice.billing_period_start} to ${invoice.billing_period_end}`,
    dueDate: invoice.due_date,
    customerName: customerResult.data.full_name,
    accountNumber: customerResult.data.account_number,
    serviceAddress: customerResult.data.service_address,
    meterNumber: meterResult.data.meter_number,
    previousReading: Number(readingResult.data.previous_reading),
    currentReading: Number(readingResult.data.current_reading),
    consumption: Number(readingResult.data.consumption),
    charges: itemResult.data.map((item) => ({ description: item.description, amount: Number(item.amount) })),
    currentCharges: Number(invoice.total_amount) - Number(invoice.previous_balance),
    previousBalance: Number(invoice.previous_balance),
    totalAmount: Number(invoice.total_amount),
    status: invoice.status,
  };
}

export async function loadInvoiceReceipt(invoiceId: string, ownerId?: string): Promise<WaterBillReceipt> {
  try { return await loadInvoiceReceiptFromServer(invoiceId); }
  catch (error) {
    if (offlineDatabaseEnabled && ownerId) {
      const { loadOfflineInvoiceReceipt } = await import('./offline-database');
      const cached = await loadOfflineInvoiceReceipt(ownerId, invoiceId);
      if (cached) return cached;
    }
    throw error;
  }
}

export async function printReceiptData(receipt: ReceiptData, options: PrintReceiptOptions = {}) {
  options.onProgress?.({ status: 'preparing' });
  if (options.virtualPrinterUrl) {
    options.onProgress?.({ status: 'sending', copy: 1, totalCopies: 1 });
    try {
      await sendToVirtualPrinter(receipt, options.virtualPrinterUrl);
      options.onProgress?.({ status: 'done', copy: 1, totalCopies: 1 });
      return;
    } catch (error) {
      const printableError = error instanceof Error ? error : new Error(String(error));
      options.onProgress?.({ status: 'error', copy: 1, totalCopies: 1, error: printableError });
      throw printableError;
    }
  }
  const printer = await loadReceiptPrinterModule();
  const ready = await printer.ensureReady();
  if (!ready.ready) throw new Error(ready.reason);
  const connected = printer.getConnectedDevice();
  if (!connected && options.printerAddress) await printer.connect(options.printerAddress);
  if (!printer.getConnectedDevice()) throw new Error('No printer is connected. Select a printer in Printer settings.');
  const unsubscribe = printer.onPrintStatus((event) => options.onProgress?.(event));
  try {
    await printer.print(receipt, { copies: 1, retries: 2, retryDelayMs: 600, chunkSize: 512, chunkDelayMs: 40, reconnect: true });
  } finally {
    unsubscribe();
  }
}

async function beginPrintAudit(options: AuditedPrintOptions) {
  const result = await supabase.rpc('begin_invoice_print', {
    p_invoice_id: options.invoiceId,
    p_is_reprint: options.isReprint,
    p_reason: options.reprintReason ?? null,
    p_metadata: { printer_name: options.printerName ?? null, printer_address: options.printerAddress ?? null } as Json,
  });
  if (result.error) {
    if (result.error.message.includes('already printed')) throw new DuplicatePrintError();
    throw result.error;
  }
  return Number(result.data);
}

async function completePrintAudit(invoiceId: string, attemptId: number, succeeded: boolean, errorMessage?: string) {
  const result = await supabase.rpc('complete_invoice_print', {
    p_invoice_id: invoiceId,
    p_attempt_id: attemptId,
    p_succeeded: succeeded,
    p_error: errorMessage ?? null,
  });
  if (result.error) throw result.error;
}

export async function printAuditedInvoiceReceipt(receipt: ReceiptData, options: AuditedPrintOptions) {
  if (options.isReprint && !options.reprintReason?.trim()) throw new Error('Enter a reason before reprinting.');
  const attemptId = await beginPrintAudit(options);
  try {
    await printReceiptData(receipt, options);
    await completePrintAudit(options.invoiceId, attemptId, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await completePrintAudit(options.invoiceId, attemptId, false, message).catch(() => undefined);
    throw error;
  }
}
