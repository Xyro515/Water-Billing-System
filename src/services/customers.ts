import { supabase } from '../lib/supabase';
import type { Tables } from '../types/database.types';
import { offlineDatabaseEnabled } from './runtimeStorage';

export const CUSTOMER_PAGE_SIZE = 20;

export type CustomerListItem = Tables<'customers'> & {
  meter: Tables<'meters'> | null;
  assignment: Tables<'meter_assignments'> | null;
  latestReading: Tables<'meter_readings'> | null;
};

export type MeterAssignmentDetail = Tables<'meter_assignments'> & {
  meter: Tables<'meters'>;
};

export type CustomerDetail = Tables<'customers'> & {
  assignments: MeterAssignmentDetail[];
  readings: Tables<'meter_readings'>[];
  outstandingBalance: number;
};

function escapeSearch(value: string) {
  return value.replace(/[%,()]/g, ' ').trim();
}

async function loadCustomerPageFromServer(query: string, page: number) {
  const search = escapeSearch(query);
  let matchingCustomerIds: string[] | null = null;

  if (search) {
    const meterResult = await supabase
      .from('meters')
      .select('id')
      .or(`meter_number.ilike.%${search}%,serial_number.ilike.%${search}%`)
      .limit(100);
    if (meterResult.error) throw meterResult.error;
    if (meterResult.data.length) {
      const assignmentResult = await supabase
        .from('meter_assignments')
        .select('customer_id')
        .in('meter_id', meterResult.data.map((meter) => meter.id));
      if (assignmentResult.error) throw assignmentResult.error;
      matchingCustomerIds = [...new Set(assignmentResult.data.map((row) => row.customer_id))];
    } else {
      matchingCustomerIds = [];
    }
  }

  let customerQuery = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .is('archived_at', null)
    .order('full_name')
    .range(page * CUSTOMER_PAGE_SIZE, (page + 1) * CUSTOMER_PAGE_SIZE - 1);

  if (search) {
    const clauses = [`full_name.ilike.%${search}%`, `account_number.ilike.%${search}%`];
    if (matchingCustomerIds?.length) clauses.push(`id.in.(${matchingCustomerIds.join(',')})`);
    customerQuery = customerQuery.or(clauses.join(','));
  }

  const customerResult = await customerQuery;
  if (customerResult.error) throw customerResult.error;
  const customerIds = customerResult.data.map((customer) => customer.id);
  if (!customerIds.length) return { items: [] as CustomerListItem[], count: customerResult.count ?? 0 };

  const assignmentResult = await supabase
    .from('meter_assignments')
    .select('*')
    .in('customer_id', customerIds)
    .is('ended_at', null);
  if (assignmentResult.error) throw assignmentResult.error;
  const meterIds = assignmentResult.data.map((assignment) => assignment.meter_id);
  const [meterResult, readingResult] = await Promise.all([
    meterIds.length ? supabase.from('meters').select('*').in('id', meterIds) : Promise.resolve({ data: [], error: null }),
    supabase.from('meter_readings').select('*').in('customer_id', customerIds).order('read_at', { ascending: false }),
  ]);
  if (meterResult.error) throw meterResult.error;
  if (readingResult.error) throw readingResult.error;

  const assignmentByCustomer = new Map(assignmentResult.data.map((row) => [row.customer_id, row]));
  const meterById = new Map(meterResult.data.map((meter) => [meter.id, meter]));
  const latestByCustomer = new Map<string, Tables<'meter_readings'>>();
  for (const reading of readingResult.data) if (!latestByCustomer.has(reading.customer_id)) latestByCustomer.set(reading.customer_id, reading);

  return {
    items: customerResult.data.map((customer) => ({
      ...customer,
      assignment: assignmentByCustomer.get(customer.id) ?? null,
      meter: meterById.get(assignmentByCustomer.get(customer.id)?.meter_id ?? '') ?? null,
      latestReading: latestByCustomer.get(customer.id) ?? null,
    })),
    count: customerResult.count ?? customerResult.data.length,
  };
}

export async function loadCustomerPage(query: string, page: number, ownerId: string) {
  try {
    const result = await loadCustomerPageFromServer(query, page);
    if (offlineDatabaseEnabled) {
      const { cacheCustomerPage } = await import('./offline-database');
      await cacheCustomerPage(ownerId, result.items);
    }
    return { ...result, source: 'server' as const };
  } catch (error) {
    if (offlineDatabaseEnabled) {
      const { loadCachedCustomerPage } = await import('./offline-database');
      const cached = await loadCachedCustomerPage(ownerId, query, page);
      if (cached.items.length || cached.count > 0) return cached;
    }
    throw error;
  }
}

async function loadCustomerDetailFromServer(customerId: string): Promise<CustomerDetail> {
  const customerResult = await supabase.from('customers').select('*').eq('id', customerId).single();
  if (customerResult.error) throw customerResult.error;
  const [assignmentResult, readingResult, arrearsResult] = await Promise.all([
    supabase.from('meter_assignments').select('*').eq('customer_id', customerId).order('started_at', { ascending: false }),
    supabase.from('meter_readings').select('*').eq('customer_id', customerId).order('read_at', { ascending: false }),
    supabase.rpc('get_customer_arrears', { p_customer_id: customerId, p_before_date: null }),
  ]);
  if (assignmentResult.error) throw assignmentResult.error;
  if (readingResult.error) throw readingResult.error;
  if (arrearsResult.error) throw arrearsResult.error;
  const meterIds = assignmentResult.data.map((assignment) => assignment.meter_id);
  const meterResult = meterIds.length
    ? await supabase.from('meters').select('*').in('id', meterIds)
    : { data: [] as Tables<'meters'>[], error: null };
  if (meterResult.error) throw meterResult.error;
  const meterById = new Map(meterResult.data.map((meter) => [meter.id, meter]));
  return {
    ...customerResult.data,
    assignments: assignmentResult.data.flatMap((assignment) => {
      const meter = meterById.get(assignment.meter_id);
      return meter ? [{ ...assignment, meter }] : [];
    }),
    readings: readingResult.data,
    outstandingBalance: Number(arrearsResult.data[0]?.previous_arrears ?? 0),
  };
}

export async function loadCustomerDetail(customerId: string, ownerId: string): Promise<CustomerDetail> {
  try {
    const detail = await loadCustomerDetailFromServer(customerId);
    if (offlineDatabaseEnabled) {
      const { cacheCustomerDetail } = await import('./offline-database');
      await cacheCustomerDetail(ownerId, detail);
    }
    return detail;
  } catch (error) {
    if (offlineDatabaseEnabled) {
      const { loadCachedCustomerDetail } = await import('./offline-database');
      const cached = await loadCachedCustomerDetail(ownerId, customerId);
      if (cached) return cached;
    }
    throw error;
  }
}

export async function findAssignedCustomerByQr(value: string, ownerId: string) {
  const normalized = value.trim();
  const encodedId = normalized.match(/^nmmpc:meter:([0-9a-f-]{36})$/i)?.[1];
  let meterQuery = supabase.from('meters').select('*').limit(1);
  meterQuery = encodedId
    ? meterQuery.eq('id', encodedId)
    : meterQuery.or(`qr_code.eq.${normalized},meter_number.eq.${normalized}`);
  const meterResult = await meterQuery.maybeSingle();
  if (meterResult.error) {
    if (offlineDatabaseEnabled) {
      const { findCachedAssignedCustomerByQr } = await import('./offline-database');
      const cached = await findCachedAssignedCustomerByQr(ownerId, value);
      if (cached) return cached;
    }
    throw meterResult.error;
  }
  if (!meterResult.data) {
    if (!offlineDatabaseEnabled) return null;
    const { findCachedAssignedCustomerByQr } = await import('./offline-database');
    return findCachedAssignedCustomerByQr(ownerId, value);
  }
  const assignmentResult = await supabase
    .from('meter_assignments')
    .select('customer_id')
    .eq('meter_id', meterResult.data.id)
    .is('ended_at', null)
    .maybeSingle();
  if (assignmentResult.error) throw assignmentResult.error;
  return assignmentResult.data ? { customerId: assignmentResult.data.customer_id, meter: meterResult.data } : null;
}

export function meterQrValue(meter: Tables<'meters'>) {
  return meter.qr_code ?? `nmmpc:meter:${meter.id}`;
}

