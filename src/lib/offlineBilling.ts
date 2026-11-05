import type { BillingTariff } from './billing';
import type { WaterBillReceipt } from './receipt';
import type { CustomerType, Database, TablesInsert } from '../types/database.types';

export type ProvisionalInvoiceSyncPayload = {
  sync_kind: 'provisional_invoice';
  customer_id: string;
  status: 'provisional';
  client_operation_id: string;
  reading: TablesInsert<'meter_readings'>;
  invoice_request: Database['public']['Functions']['create_invoice_atomic']['Args'];
  receipt: WaterBillReceipt;
};

export function assertCachedTariffEligible(tariff: BillingTariff, customerType: CustomerType, billingDate: string) {
  if (!tariff.is_approved || tariff.archived_at) throw new Error('The cached tariff is not approved for offline billing.');
  if (tariff.customer_type !== customerType) throw new Error('The cached tariff does not match the customer classification.');
  if (billingDate < tariff.effective_from || (tariff.effective_to && billingDate > tariff.effective_to)) {
    throw new Error('No approved cached tariff is effective for this billing period.');
  }
}

export function isProvisionalInvoiceSyncPayload(payload: Record<string, unknown>): payload is ProvisionalInvoiceSyncPayload {
  return payload.sync_kind === 'provisional_invoice'
    && payload.status === 'provisional'
    && typeof payload.customer_id === 'string'
    && typeof payload.client_operation_id === 'string'
    && Boolean(payload.reading && typeof payload.reading === 'object')
    && Boolean(payload.invoice_request && typeof payload.invoice_request === 'object')
    && Boolean(payload.receipt && typeof payload.receipt === 'object');
}

export function finalizeProvisionalReceipt(receipt: WaterBillReceipt, invoice: { id: string; invoice_number: string; issued_at: string; status: string }) {
  return { ...receipt, invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, issuedAt: invoice.issued_at, status: invoice.status, preview: false, provisional: false } satisfies WaterBillReceipt;
}
