import fs from 'node:fs';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

function loadEnvironmentFile(path) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const name = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!process.env[name]) process.env[name] = value;
  }
}

loadEnvironmentFile('.env');
loadEnvironmentFile('.env.test');

const requiredNames = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'TEST_EMPLOYEE_EMAIL',
  'TEST_EMPLOYEE_PASSWORD',
  'TEST_ADMIN_EMAIL',
  'TEST_ADMIN_PASSWORD',
];
const missingNames = requiredNames.filter((name) => !process.env[name]);
if (missingNames.length) {
  console.error(`Missing acceptance-test configuration: ${missingNames.join(', ')}`);
  console.error('Copy .env.test.example to .env.test and use dedicated test accounts.');
  process.exit(2);
}

const placeholderNames = requiredNames.filter((name) => {
  const value = process.env[name] ?? '';
  return value.includes('example.com') || value.startsWith('replace-');
});
if (placeholderNames.length) {
  console.error(`Placeholder acceptance-test values must be replaced: ${placeholderNames.join(', ')}`);
  console.error('Create dedicated confirmed users in Supabase Auth, then update the ignored .env.test file.');
  process.exit(2);
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const createTestClient = () => createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  options,
);

const employee = createTestClient();
const administrator = createTestClient();
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const assignedAccount = `ACCEPT-ASSIGNED-${suffix}`;
const hiddenAccount = `ACCEPT-HIDDEN-${suffix}`;
let assignedCustomerId = null;
let hiddenCustomerId = null;
let initialMeterId = null;
let replacementMeterId = null;
let billingRuleTariffId = null;
let billingInvoiceId = null;
const expectedPreviousReading = 112.5;
const expectedBillingPeriodStart = '2026-10-01';
const expectedBillingPeriodEnd = '2026-10-31';
let failures = 0;
let employeeProfile = null;
let administratorReady = false;
let revokedEmployeeSession = null;

async function check(name, callback) {
  try {
    await callback();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures += 1;
    const detail = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error);
    console.error(`FAIL  ${name}: ${detail}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await check('Employee can sign in securely', async () => {
    const { data, error } = await employee.auth.signInWithPassword({
      email: process.env.TEST_EMPLOYEE_EMAIL,
      password: process.env.TEST_EMPLOYEE_PASSWORD,
    });
    if (error) throw error;
    assert(data.session?.user, 'No employee session was returned.');
    revokedEmployeeSession = data.session;
    const profileResult = await employee.from('profiles').select('*').eq('id', data.session.user.id).single();
    if (profileResult.error) throw profileResult.error;
    assert(profileResult.data.role === 'employee', 'Test employee does not have the employee role.');
    assert(profileResult.data.is_active, 'Test employee account is disabled.');
    employeeProfile = profileResult.data;
  });

  await check('Administrator can sign in and manage authorized records', async () => {
    const { data, error } = await administrator.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASSWORD,
    });
    if (error) throw error;
    assert(data.session?.user, 'No administrator session was returned.');
    const profileResult = await administrator.from('profiles').select('*').eq('id', data.session.user.id).single();
    if (profileResult.error) throw profileResult.error;
    assert(profileResult.data.role === 'administrator', 'Test administrator does not have the administrator role.');
    administratorReady = true;

    if (!employeeProfile) return;

    const createResult = await administrator.from('customers').insert([
      { account_number: assignedAccount, full_name: 'Acceptance Assigned', service_address: 'Test address', assigned_employee_id: employeeProfile.id },
      { account_number: hiddenAccount, full_name: 'Acceptance Hidden', service_address: 'Test address', assigned_employee_id: null },
    ]).select('id, account_number');
    if (createResult.error) throw createResult.error;
    assignedCustomerId = createResult.data.find((row) => row.account_number === assignedAccount)?.id ?? null;
    hiddenCustomerId = createResult.data.find((row) => row.account_number === hiddenAccount)?.id ?? null;
    assert(assignedCustomerId && hiddenCustomerId, 'Administrator could not create acceptance fixtures.');

    const meterResult = await administrator.from('meters').insert({
      meter_number: `METER-${suffix}`,
      serial_number: `SERIAL-${suffix}`,
      qr_code: `nmmpc:test:${suffix}`,
      installed_at: new Date().toISOString().slice(0, 10),
    }).select('id').single();
    if (meterResult.error) throw meterResult.error;
    initialMeterId = meterResult.data.id;
    const assignmentResult = await administrator.from('meter_assignments').insert({
      customer_id: assignedCustomerId,
      meter_id: initialMeterId,
      assigned_by: data.session.user.id,
    });
    if (assignmentResult.error) throw assignmentResult.error;

    const readingResult = await administrator.from('meter_readings').insert({
      customer_id: assignedCustomerId,
      meter_id: initialMeterId,
      employee_id: employeeProfile.id,
      previous_reading: 100,
      current_reading: expectedPreviousReading,
      consumption: 12.5,
      billing_period_start: expectedBillingPeriodStart,
      billing_period_end: expectedBillingPeriodEnd,
      read_at: '2026-10-31T08:00:00+08:00',
    });
    if (readingResult.error) throw readingResult.error;

    const updateResult = await administrator.from('customers').update({ notes: 'Acceptance test managed by administrator' }).eq('id', assignedCustomerId);
    if (updateResult.error) throw updateResult.error;
  });

  if (!employeeProfile || !administratorReady || !assignedCustomerId || !hiddenCustomerId) {
    console.log('SKIP  Employee sees only assigned customers: authenticated fixtures are unavailable.');
    console.log('SKIP  Unauthorized reads and writes are rejected: authenticated fixtures are unavailable.');
  } else {
    await check('Employee sees only assigned customers', async () => {
    assert(assignedCustomerId && hiddenCustomerId, 'Customer fixtures were not created.');
    const { data, error } = await employee.from('customers').select('id, account_number').in('id', [assignedCustomerId, hiddenCustomerId]);
    if (error) throw error;
    assert(data.length === 1, `Expected one visible customer, received ${data.length}.`);
    assert(data[0].id === assignedCustomerId, 'Employee could access an unassigned customer.');
    });

    await check('Unauthorized reads and writes are rejected', async () => {
    const hiddenRead = await employee.from('customers').select('id').eq('id', hiddenCustomerId).maybeSingle();
    if (hiddenRead.error) throw hiddenRead.error;
    assert(hiddenRead.data === null, 'Employee read an unassigned customer.');

    const tariffWrite = await employee.from('tariffs').insert({
      code: `DENY-${suffix}`,
      name: 'Unauthorized tariff',
      version: 1,
      effective_from: new Date().toISOString().slice(0, 10),
    });
    assert(!!tariffWrite.error, 'Employee unexpectedly created a tariff.');
    });

    await check('Employee can search assigned customer and load active meter details', async () => {
      const customerSearch = await employee.from('customers').select('id,account_number,phone,email,service_address,notes,status').ilike('full_name', '%aCcEpTaNcE aSsIgNeD%');
      if (customerSearch.error) throw customerSearch.error;
      assert(customerSearch.data.length === 1 && customerSearch.data[0].id === assignedCustomerId, 'Assigned customer search returned the wrong result.');
      const assignments = await employee.from('meter_assignments').select('meter_id,started_at,ended_at').eq('customer_id', assignedCustomerId).is('ended_at', null);
      if (assignments.error) throw assignments.error;
      assert(assignments.data.length === 1 && assignments.data[0].meter_id === initialMeterId, 'Active meter assignment was not visible.');
      const meter = await employee.from('meters').select('id,meter_number,serial_number,qr_code,status,installed_at').eq('id', initialMeterId).single();
      if (meter.error) throw meter.error;
      assert(meter.data.qr_code === `nmmpc:test:${suffix}`, 'QR identification value was not preserved.');
    });

    await check('Meter QR resolves to the correct assigned customer and meter', async () => {
      const meter = await employee.from('meters').select('id,qr_code').eq('qr_code', `nmmpc:test:${suffix}`).single();
      if (meter.error) throw meter.error;
      assert(meter.data.id === initialMeterId, 'QR value resolved to the wrong meter.');
      const assignment = await employee.from('meter_assignments').select('customer_id,meter_id').eq('meter_id', meter.data.id).is('ended_at', null).single();
      if (assignment.error) throw assignment.error;
      assert(assignment.data.customer_id === assignedCustomerId, 'QR meter resolved to the wrong customer.');
    });

    await check('Previous reading and billing period are correct', async () => {
      const latest = await employee.from('meter_readings').select('current_reading,billing_period_start,billing_period_end,meter_id').eq('customer_id', assignedCustomerId).order('read_at', { ascending: false }).limit(1).single();
      if (latest.error) throw latest.error;
      assert(Number(latest.data.current_reading) === expectedPreviousReading, `Expected previous reading ${expectedPreviousReading}, received ${latest.data.current_reading}.`);
      assert(latest.data.billing_period_start === expectedBillingPeriodStart, `Unexpected billing period start: ${latest.data.billing_period_start}.`);
      assert(latest.data.billing_period_end === expectedBillingPeriodEnd, `Unexpected billing period end: ${latest.data.billing_period_end}.`);
      assert(latest.data.meter_id === initialMeterId, 'Latest reading belongs to the wrong meter.');
    });

    await check('Administrator can atomically replace a meter and preserve assignment history', async () => {
      const replacement = await administrator.rpc('replace_customer_meter', {
        target_customer_id: assignedCustomerId,
        new_meter_number: `REPLACEMENT-${suffix}`,
        new_serial_number: `REPLACEMENT-SERIAL-${suffix}`,
        replacement_date: new Date().toISOString().slice(0, 10),
        new_initial_reading: 0,
      });
      if (replacement.error) throw replacement.error;
      replacementMeterId = replacement.data;
      const history = await administrator.from('meter_assignments').select('meter_id,ended_at').eq('customer_id', assignedCustomerId).order('created_at');
      if (history.error) throw history.error;
      assert(history.data.length === 2, `Expected two assignment records, received ${history.data.length}.`);
      assert(!!history.data.find((row) => row.meter_id === initialMeterId)?.ended_at, 'Old assignment was not closed.');
      assert(history.data.find((row) => row.meter_id === replacementMeterId)?.ended_at === null, 'Replacement meter is not active.');
      const oldMeter = await administrator.from('meters').select('status').eq('id', initialMeterId).single();
      if (oldMeter.error) throw oldMeter.error;
      assert(oldMeter.data.status === 'replaced', 'Old meter was not marked as replaced.');
      const employeeHistory = await employee.from('meters').select('id,status').in('id', [initialMeterId, replacementMeterId]);
      if (employeeHistory.error) throw employeeHistory.error;
      assert(employeeHistory.data.length === 2, 'Employee could not load both active and historical assigned meters.');
    });

    await check('Billing-rule configuration is versioned, constrained, and hidden until approved', async () => {
      const tariff = await administrator.from('tariffs').insert({
        code: `ACCEPT-BILLING-${suffix}`,
        name: 'Acceptance Billing Rules',
        version: 2,
        effective_from: '2026-11-01',
        effective_to: '2026-12-31',
        fixed_charge: 85,
        tax_name: 'None',
        tax_rate: 0,
        discount_rate: 0.05,
        subsidy_amount: 20,
        penalty_rate: 0.02,
        penalty_grace_days: 5,
        due_days: 15,
        minimum_charge: 100,
        apply_previous_balance: true,
        meter_rollover_value: 1000,
        rounding_scale: 2,
        rounding_mode: 'half_up',
      }).select('*').single();
      if (tariff.error) throw tariff.error;
      billingRuleTariffId = tariff.data.id;
      assert(tariff.data.version === 2 && tariff.data.due_days === 15, 'Version or due-date rule was not stored.');
      assert(Number(tariff.data.minimum_charge) === 100 && Number(tariff.data.penalty_rate) === 0.02, 'Charge or penalty rule was not stored.');
      assert(tariff.data.rounding_mode === 'half_up' && tariff.data.rounding_scale === 2, 'Rounding rule was not stored.');

      const tiers = await administrator.from('tariff_tiers').insert([
        { tariff_id: billingRuleTariffId, minimum_volume: 0, maximum_volume: 10, rate_per_unit: 20, sort_order: 1 },
        { tariff_id: billingRuleTariffId, minimum_volume: 10, maximum_volume: null, rate_per_unit: 26.5, sort_order: 2 },
      ]);
      if (tiers.error) throw tiers.error;

      const employeeRead = await employee.from('tariffs').select('id').eq('id', billingRuleTariffId).maybeSingle();
      if (employeeRead.error) throw employeeRead.error;
      assert(employeeRead.data === null, 'Employee could read an unapproved tariff.');

      const invalid = await administrator.from('tariffs').insert({
        code: `ACCEPT-INVALID-${suffix}`,
        name: 'Invalid Acceptance Rules',
        version: 1,
        effective_from: '2026-11-01',
        tax_name: 'None',
        tax_rate: 0.12,
      });
      assert(!!invalid.error, 'An inconsistent tax name and non-zero rate were accepted.');
    });

    await check('Invoice creation is atomic, uniquely numbered, and idempotent when an approved tariff exists', async () => {
      const approvedTariff = await administrator.from('tariffs').select('id').eq('customer_type', 'member').eq('is_approved', true).lte('effective_from', expectedBillingPeriodEnd).or(`effective_to.is.null,effective_to.gte.${expectedBillingPeriodEnd}`).limit(1).maybeSingle();
      if (approvedTariff.error) throw approvedTariff.error;
      if (!approvedTariff.data) { console.log('SKIP  Invoice persistence fixture: no approved tariff covers the acceptance billing period.'); return; }
      const reading = await administrator.from('meter_readings').select('id').eq('customer_id', assignedCustomerId).limit(1).single();
      if (reading.error) throw reading.error;
      const operationId = crypto.randomUUID();
      const args = {
        p_customer_id: assignedCustomerId,
        p_meter_reading_id: reading.data.id,
        p_tariff_id: approvedTariff.data.id,
        p_billing_period_start: expectedBillingPeriodStart,
        p_billing_period_end: expectedBillingPeriodEnd,
        p_due_date: '2026-11-15',
        p_subtotal: 125,
        p_fixed_charges: 50,
        p_discounts: 0,
        p_taxes: 0,
        p_penalties: 0,
        p_previous_balance: 0,
        p_total_amount: 175,
        p_tariff_snapshot: { acceptance_test: true },
        p_client_operation_id: operationId,
        p_items: [{ item_type: 'usage', description: 'Acceptance usage', quantity: 12.5, unit_price: 10, amount: 125, sort_order: 1, calculation_snapshot: {} }],
      };
      const first = await administrator.rpc('create_invoice_atomic', args);
      if (first.error) throw first.error;
      const second = await administrator.rpc('create_invoice_atomic', args);
      if (second.error) throw second.error;
      billingInvoiceId = first.data.id;
      assert(first.data.id === second.data.id, 'Retry created a different invoice.');
      assert(/^NMMPC-\d{6}-\d{8}$/.test(first.data.invoice_number), `Unexpected invoice number: ${first.data.invoice_number}.`);
      const items = await administrator.from('invoice_items').select('id').eq('invoice_id', billingInvoiceId);
      if (items.error) throw items.error;
      assert(items.data.length === 1, `Expected one detailed invoice item, received ${items.data.length}.`);
    });
  }

  await check('Cleared sessions lose backend access', async () => {
    const { error } = await employee.auth.signOut();
    if (error) throw error;
    const sessionResult = await employee.auth.getSession();
    assert(sessionResult.data.session === null, 'Employee session remained after sign-out.');
    const anonymousRead = await employee.from('customers').select('id').limit(1);
    assert(!!anonymousRead.error, 'A signed-out client retained customer access.');
  });

  await check('Expired or revoked sessions are cleared and lose backend access', async () => {
    assert(revokedEmployeeSession, 'No employee token pair was captured.');
    const staleClient = createTestClient();
    const restored = await staleClient.auth.setSession({
      access_token: revokedEmployeeSession.access_token,
      refresh_token: revokedEmployeeSession.refresh_token,
    });
    assert(!!restored.error, 'A revoked refresh token unexpectedly restored a session.');
    const current = await staleClient.auth.getSession();
    assert(current.data.session === null, 'The stale session was not cleared after refresh rejection.');
    const denied = await staleClient.from('customers').select('id').limit(1);
    assert(!!denied.error, 'A client with an expired or revoked session retained backend access.');
  });
} finally {
  if (assignedCustomerId || hiddenCustomerId) {
    if (billingRuleTariffId) {
      const tariffCleanup = await administrator.from('tariffs').delete().eq('id', billingRuleTariffId);
      if (tariffCleanup.error) { failures += 1; console.error(`FAIL  Tariff fixture cleanup: ${tariffCleanup.error.message}`); }
    }
    if (assignedCustomerId) {
      if (billingInvoiceId) {
        const invoiceCleanup = await administrator.from('invoices').delete().eq('id', billingInvoiceId);
        if (invoiceCleanup.error) { failures += 1; console.error(`FAIL  Invoice fixture cleanup: ${invoiceCleanup.error.message}`); }
      }
      const readingCleanup = await administrator.from('meter_readings').delete().eq('customer_id', assignedCustomerId);
      if (readingCleanup.error) { failures += 1; console.error(`FAIL  Reading fixture cleanup: ${readingCleanup.error.message}`); }
      const assignmentCleanup = await administrator.from('meter_assignments').delete().eq('customer_id', assignedCustomerId);
      if (assignmentCleanup.error) { failures += 1; console.error(`FAIL  Assignment fixture cleanup: ${assignmentCleanup.error.message}`); }
    }
    const meterIds = [initialMeterId, replacementMeterId].filter(Boolean);
    if (meterIds.length) {
      const meterCleanup = await administrator.from('meters').delete().in('id', meterIds);
      if (meterCleanup.error) { failures += 1; console.error(`FAIL  Meter fixture cleanup: ${meterCleanup.error.message}`); }
    }
    const ids = [assignedCustomerId, hiddenCustomerId].filter(Boolean);
    const cleanup = await administrator.from('customers').delete().in('id', ids);
    if (cleanup.error) {
      failures += 1;
      console.error(`FAIL  Acceptance fixture cleanup: ${cleanup.error.message}`);
    } else {
      console.log('PASS  Acceptance fixture cleanup');
    }
  }
  await administrator.auth.signOut();
}

if (failures) {
  console.error(`${failures} backend acceptance check(s) failed.`);
  process.exit(1);
}
console.log('All backend acceptance checks passed.');
