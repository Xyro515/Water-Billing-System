import { calculateBill, type BillingInput, type BillingTier, type BillingTariff } from '../lib/billing';
import { customerTariffCode } from '../lib/memberBilling';
import { assertCachedTariffEligible, type ProvisionalInvoiceSyncPayload } from '../lib/offlineBilling';
import { supabase } from '../lib/supabase';
import type { WaterBillReceipt } from '../lib/receipt';
import type { CustomerType, Json } from '../types/database.types';
import { classifySyncFailure, syncFailureMessage } from '../lib/syncPolicy';
import { offlineDatabaseEnabled } from './runtimeStorage';

export type CreateInvoiceRequest = {
  customerId: string;
  meterReadingId: string;
  clientOperationId: string;
  input: BillingInput;
  tariff: BillingTariff;
  tiers: BillingTier[];
};

export type SaveReadingAndInvoiceRequest = {
  customerId: string;
  meterId: string;
  employeeId: string;
  capturedAt: string;
  condition: BillingInput['condition'];
  photoPath?: string;
  fractionalDigits?: string;
  input: BillingInput;
  readingOperationId: string;
  invoiceOperationId: string;
};

export async function loadCustomerArrears(customerId: string, beforeDate?: string) {
  const result = await supabase.rpc('get_customer_arrears', { p_customer_id: customerId, p_before_date: beforeDate ?? null });
  if (result.error) throw result.error;
  const summary = result.data[0];
  return {
    previousArrears: Number(summary?.previous_arrears ?? 0),
    oldestDueDate: summary?.oldest_due_date ?? null,
    openInvoiceCount: Number(summary?.open_invoice_count ?? 0),
  };
}

export async function loadApprovedTariffForCustomer(customerId: string, billingDate: string, offline?: { ownerId: string; customerType: CustomerType }) {
  try {
    const customerResult = await supabase.from('customers').select('customer_type').eq('id', customerId).single();
    if (customerResult.error) throw customerResult.error;
    const code = customerTariffCode(customerResult.data.customer_type);
    const tariffResult = await supabase
      .from('tariffs')
      .select('*')
      .eq('code', code)
      .eq('customer_type', customerResult.data.customer_type)
      .eq('is_approved', true)
      .is('archived_at', null)
      .lte('effective_from', billingDate)
      .or(`effective_to.is.null,effective_to.gte.${billingDate}`)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tariffResult.error) throw tariffResult.error;
    if (!tariffResult.data) throw new Error(`No approved ${customerResult.data.customer_type.replace('_', '-')} tariff is effective for this billing period.`);
    const tierResult = await supabase.from('tariff_tiers').select('*').eq('tariff_id', tariffResult.data.id).order('sort_order');
    if (tierResult.error) throw tierResult.error;
    if (offlineDatabaseEnabled && offline) {
      const { cacheApprovedTariffs } = await import('./offline-database');
      await cacheApprovedTariffs(offline.ownerId, [tariffResult.data], tierResult.data).catch(() => undefined);
    }
    return { customerType: customerResult.data.customer_type, tariff: tariffResult.data, tiers: tierResult.data, source: 'server' as const };
  } catch (reason) {
    const transient = classifySyncFailure(syncFailureMessage(reason)) === 'transient';
    if (!transient || !offlineDatabaseEnabled || !offline) throw reason;
    const { getCachedApprovedTariff } = await import('./offline-database');
    const cached = await getCachedApprovedTariff(offline.ownerId, customerTariffCode(offline.customerType), billingDate);
    if (!cached) throw new Error('No approved cached tariff is effective for this billing period. Reconnect before creating a bill.');
    assertCachedTariffEligible(cached.tariff, offline.customerType, billingDate);
    return { customerType: offline.customerType, tariff: cached.tariff, tiers: cached.tiers, source: 'cache' as const };
  }
}

export async function calculateAndCreateCustomerInvoice(request: Omit<CreateInvoiceRequest, 'tariff' | 'tiers'>) {
  const selected = await loadApprovedTariffForCustomer(request.customerId, request.input.billingPeriodEnd);
  return calculateAndCreateInvoice({ ...request, tariff: selected.tariff, tiers: selected.tiers });
}

export async function saveReadingAndInvoice(request: SaveReadingAndInvoiceRequest) {
  const selected = await loadApprovedTariffForCustomer(request.customerId, request.input.billingPeriodEnd);
  const consumption = calculateBill(request.input, selected.tariff, selected.tiers).consumption;
  const readingPayload = {
    customer_id: request.customerId,
    meter_id: request.meterId,
    employee_id: request.employeeId,
    previous_reading: request.input.previousReading,
    current_reading: request.input.currentReading,
    consumption,
    condition: request.condition,
    billing_period_start: request.input.billingPeriodStart,
    billing_period_end: request.input.billingPeriodEnd,
    read_at: request.capturedAt,
    photo_path: request.photoPath ?? null,
    notes: request.fractionalDigits ? `Red fractional digits: ${request.fractionalDigits}` : null,
    client_operation_id: request.readingOperationId,
  };
  const inserted = await supabase.from('meter_readings').insert(readingPayload).select('*').single();
  let reading = inserted.data;
  if (inserted.error) {
    const retry = await supabase.from('meter_readings').select('*').eq('client_operation_id', request.readingOperationId).maybeSingle();
    if (retry.error || !retry.data) throw inserted.error;
    reading = retry.data;
  }
  if (!reading) throw new Error('The meter reading could not be saved.');
  const created = await calculateAndCreateInvoice({
    customerId: request.customerId,
    meterReadingId: reading.id,
    clientOperationId: request.invoiceOperationId,
    input: request.input,
    tariff: selected.tariff,
    tiers: selected.tiers,
  });
  return { reading, ...created };
}

export async function calculateAndCreateInvoice(request: CreateInvoiceRequest) {
  const calculation = calculateBill(request.input, request.tariff, request.tiers);
  const result = await supabase.rpc('create_invoice_atomic', {
    p_customer_id: request.customerId,
    p_meter_reading_id: request.meterReadingId,
    p_tariff_id: request.tariff.id,
    p_billing_period_start: request.input.billingPeriodStart,
    p_billing_period_end: request.input.billingPeriodEnd,
    p_due_date: calculation.dueDate,
    p_subtotal: calculation.subtotal,
    p_fixed_charges: calculation.fixedCharges,
    p_discounts: calculation.discounts,
    p_taxes: calculation.taxes,
    p_penalties: calculation.penalties,
    p_previous_balance: calculation.previousBalance,
    p_total_amount: calculation.totalAmount,
    p_tariff_snapshot: calculation.tariffSnapshot as Json,
    p_client_operation_id: request.clientOperationId,
    p_items: calculation.items as Json,
  });
  if (result.error) throw result.error;
  return { invoice: result.data, calculation };
}

export async function saveOfflineProvisionalReadingAndInvoice(request: SaveReadingAndInvoiceRequest & { tariff: BillingTariff; tiers: BillingTier[]; receipt: WaterBillReceipt }) {
  if (!offlineDatabaseEnabled) throw new Error('Offline provisional billing requires a development build with local database support.');
  const calculation = calculateBill(request.input, request.tariff, request.tiers);
  const reading = {
    id: request.readingOperationId,
    customer_id: request.customerId,
    meter_id: request.meterId,
    employee_id: request.employeeId,
    previous_reading: request.input.previousReading,
    current_reading: request.input.currentReading,
    consumption: calculation.consumption,
    condition: request.condition,
    billing_period_start: request.input.billingPeriodStart,
    billing_period_end: request.input.billingPeriodEnd,
    read_at: request.capturedAt,
    photo_path: request.photoPath ?? null,
    notes: request.fractionalDigits ? `Red fractional digits: ${request.fractionalDigits}` : null,
    client_operation_id: request.readingOperationId,
  };
  const invoiceRequest = {
    p_customer_id: request.customerId,
    p_meter_reading_id: request.readingOperationId,
    p_tariff_id: request.tariff.id,
    p_billing_period_start: request.input.billingPeriodStart,
    p_billing_period_end: request.input.billingPeriodEnd,
    p_due_date: calculation.dueDate,
    p_subtotal: calculation.subtotal,
    p_fixed_charges: calculation.fixedCharges,
    p_discounts: calculation.discounts,
    p_taxes: calculation.taxes,
    p_penalties: calculation.penalties,
    p_previous_balance: calculation.previousBalance,
    p_total_amount: calculation.totalAmount,
    p_tariff_snapshot: calculation.tariffSnapshot as Json,
    p_client_operation_id: request.invoiceOperationId,
    p_items: calculation.items as Json,
  };
  const provisionalReceipt = { ...request.receipt, invoiceId: request.invoiceOperationId, invoiceNumber: `PROVISIONAL-${request.receipt.accountNumber}`.slice(0, 28), status: 'provisional', preview: false, provisional: true };
  const payload: ProvisionalInvoiceSyncPayload = { sync_kind: 'provisional_invoice', customer_id: request.customerId, status: 'provisional', client_operation_id: request.invoiceOperationId, reading, invoice_request: invoiceRequest, receipt: provisionalReceipt };
  const { saveOfflineProvisionalBilling } = await import('./offline-database');
  await saveOfflineProvisionalBilling(request.employeeId, request.readingOperationId, reading, request.invoiceOperationId, payload);
  return { provisionalInvoiceId: request.invoiceOperationId, receipt: provisionalReceipt, calculation };
}

