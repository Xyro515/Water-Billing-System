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

const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'TEST_EMPLOYEE_EMAIL', 'TEST_EMPLOYEE_PASSWORD', 'TEST_ADMIN_EMAIL', 'TEST_ADMIN_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing configuration: ${missing.join(', ')}`);

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const client = () => createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const employee = client();
const administrator = client();

const demoMembers = [
  { account_number: 'DEMO-MEMBER-0001', full_name: 'Demo Member One', customer_type: 'member', service_address: 'Demo Address 1, Test Barangay', phone: '000-000-0001', route_code: 'DEMO-ROUTE', notes: 'Non-personal development member record.', meter_number: 'DEMO-METER-0001', serial_number: 'DEMO-SERIAL-0001' },
  { account_number: 'DEMO-MEMBER-0002', full_name: 'Demo Non-Member Two', customer_type: 'non_member', service_address: 'Demo Address 2, Test Barangay', phone: '000-000-0002', route_code: 'DEMO-ROUTE', notes: 'Non-personal development non-member record.', meter_number: 'DEMO-METER-0002', serial_number: 'DEMO-SERIAL-0002' },
];

try {
  const employeeSignIn = await employee.auth.signInWithPassword({ email: process.env.TEST_EMPLOYEE_EMAIL, password: process.env.TEST_EMPLOYEE_PASSWORD });
  if (employeeSignIn.error || !employeeSignIn.data.user) throw employeeSignIn.error ?? new Error('Test employee sign-in failed.');
  const adminSignIn = await administrator.auth.signInWithPassword({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD });
  if (adminSignIn.error) throw adminSignIn.error;

  for (const member of demoMembers) {
    const customerResult = await administrator.from('customers').upsert({
      account_number: member.account_number,
      full_name: member.full_name,
      service_address: member.service_address,
      phone: member.phone,
      customer_type: member.customer_type,
      status: 'active',
      assigned_employee_id: employeeSignIn.data.user.id,
      route_code: member.route_code,
      notes: member.notes,
      archived_at: null,
    }, { onConflict: 'account_number' }).select('id,account_number').single();
    if (customerResult.error) throw customerResult.error;

    const meterResult = await administrator.from('meters').upsert({
      meter_number: member.meter_number,
      serial_number: member.serial_number,
      qr_code: `nmmpc:demo:${member.meter_number}`,
      manufacturer: 'Demo Manufacturer',
      model: 'Demo Model',
      status: 'active',
      installed_at: '2026-01-01',
      initial_reading: 0,
      archived_at: null,
    }, { onConflict: 'meter_number' }).select('id,meter_number').single();
    if (meterResult.error) throw meterResult.error;

    const activeAssignment = await administrator.from('meter_assignments').select('id,meter_id').eq('customer_id', customerResult.data.id).is('ended_at', null).maybeSingle();
    if (activeAssignment.error) throw activeAssignment.error;
    if (!activeAssignment.data) {
      const assignment = await administrator.from('meter_assignments').insert({ customer_id: customerResult.data.id, meter_id: meterResult.data.id, assigned_by: adminSignIn.data.user?.id, started_at: '2026-01-01' });
      if (assignment.error) throw assignment.error;
    } else if (activeAssignment.data.meter_id !== meterResult.data.id) {
      throw new Error(`${member.account_number} already has a different active meter.`);
    }
    console.log(`READY ${member.account_number} / ${member.meter_number}`);
  }
  const visibleMembers = await employee.from('customers').select('account_number,customer_type').in('account_number', demoMembers.map((member) => member.account_number));
  if (visibleMembers.error) throw visibleMembers.error;
  if (visibleMembers.data.length !== demoMembers.length) throw new Error(`Test employee can see ${visibleMembers.data.length} of ${demoMembers.length} demo members.`);
  for (const member of demoMembers) {
    const stored = visibleMembers.data.find((row) => row.account_number === member.account_number);
    if (stored?.customer_type !== member.customer_type) throw new Error(`${member.account_number} customer type was not saved correctly.`);
  }
  const tariffResult = await employee.from('tariffs').select('id,code,version,customer_type,fixed_charge,minimum_charge').in('code', ['MEMBER_RESIDENTIAL', 'NON_MEMBER_RESIDENTIAL']).eq('version', 2).eq('is_approved', true);
  if (tariffResult.error) throw tariffResult.error;
  if (tariffResult.data.length !== 2) throw new Error(`Expected two approved membership tariffs, received ${tariffResult.data.length}.`);
  for (const tariff of tariffResult.data) {
    const expectedBase = tariff.customer_type === 'member' ? 150 : 200;
    if (Number(tariff.fixed_charge) !== expectedBase || Number(tariff.minimum_charge) !== expectedBase) throw new Error(`${tariff.code} base charge is incorrect.`);
    const tierResult = await employee.from('tariff_tiers').select('minimum_volume,maximum_volume,rate_per_unit,sort_order').eq('tariff_id', tariff.id).order('sort_order');
    if (tierResult.error) throw tierResult.error;
    if (tierResult.data.length !== 2 || Number(tierResult.data[0].rate_per_unit) !== 0 || Number(tierResult.data[1].minimum_volume) !== 10 || Number(tierResult.data[1].rate_per_unit) !== 15) throw new Error(`${tariff.code} tiers are incorrect.`);
  }
  console.log(`VERIFIED ${visibleMembers.data.length} demo members visible to the test employee`);
} finally {
  await employee.auth.signOut();
  await administrator.auth.signOut();
}

