import type { Tables } from '../types/database.types';

export type MeterCondition = 'normal' | 'rollover' | 'replaced';
export type BillingInput = {
  previousReading: number;
  currentReading: number;
  condition: MeterCondition;
  replacementInitialReading?: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  previousBalance?: number;
  previousBalanceAgeDays?: number;
};
export type BillingTariff = Tables<'tariffs'>;
export type BillingTier = Tables<'tariff_tiers'>;
export type BillingLineItem = {
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  calculation_snapshot: Record<string, string | number | boolean | null>;
};
export type BillingResult = {
  consumption: number;
  subtotal: number;
  fixedCharges: number;
  discounts: number;
  taxes: number;
  penalties: number;
  previousBalance: number;
  totalAmount: number;
  dueDate: string;
  items: BillingLineItem[];
  tariffSnapshot: Record<string, unknown>;
};

const EPSILON = 1e-9;
const assertFiniteNonnegative = (value: number, label: string) => { if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative number.`); };

export function roundBillingValue(value: number, scale: number, mode: BillingTariff['rounding_mode']) {
  if (!Number.isFinite(value)) throw new Error('Cannot round a non-finite value.');
  const factor = 10 ** scale;
  const scaled = value * factor;
  if (mode === 'up') return Math.ceil(scaled - EPSILON) / factor;
  if (mode === 'down') return Math.floor(scaled + EPSILON) / factor;
  if (mode === 'half_even') {
    const floor = Math.floor(scaled); const fraction = scaled - floor;
    if (Math.abs(fraction - 0.5) <= EPSILON) return (floor % 2 === 0 ? floor : floor + 1) / factor;
    return Math.round(scaled) / factor;
  }
  return Math.floor(scaled + 0.5 + EPSILON) / factor;
}

export function calculateConsumption(input: BillingInput, rolloverValue: number) {
  assertFiniteNonnegative(input.previousReading, 'Previous reading');
  assertFiniteNonnegative(input.currentReading, 'Current reading');
  assertFiniteNonnegative(rolloverValue, 'Meter rollover value');
  if (input.condition === 'replaced') {
    const initial = input.replacementInitialReading ?? 0;
    assertFiniteNonnegative(initial, 'Replacement initial reading');
    if (input.currentReading < initial) throw new Error('Current reading cannot be below the replacement meter initial reading.');
    return input.currentReading - initial;
  }
  if (input.condition === 'rollover') {
    const consumption = rolloverValue + input.currentReading - input.previousReading;
    if (consumption < 0 || consumption > rolloverValue) throw new Error('The readings do not form a valid meter rollover.');
    return consumption;
  }
  if (input.currentReading < input.previousReading) throw new Error('Current reading cannot be below the previous reading.');
  return input.currentReading - input.previousReading;
}

function validateTariff(tariff: BillingTariff, tiers: BillingTier[], billingDate: string) {
  if (!tariff.is_approved) throw new Error('The tariff is not approved.');
  if (billingDate < tariff.effective_from || (tariff.effective_to && billingDate > tariff.effective_to)) throw new Error('No approved tariff is effective for this billing period.');
  const sorted = [...tiers].sort((left, right) => left.minimum_volume - right.minimum_volume);
  if (!sorted.length || sorted[0].minimum_volume !== 0) throw new Error('Tariff tiers must start at zero.');
  for (let index = 0; index < sorted.length; index += 1) {
    const tier = sorted[index];
    if (tier.tariff_id !== tariff.id) throw new Error('A tier belongs to a different tariff.');
    if (index < sorted.length - 1 && tier.maximum_volume !== sorted[index + 1].minimum_volume) throw new Error('Tariff tiers must be contiguous.');
    if (index === sorted.length - 1 && tier.maximum_volume !== null) throw new Error('The final tariff tier must be open-ended.');
  }
  return sorted;
}

function addCalendarDays(date: string, days: number) { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }

function billingNumber(value: number) {
  return value.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function billingMoney(value: number) {
  return `PHP ${value.toFixed(2)}`;
}

export function calculateBill(input: BillingInput, tariff: BillingTariff, tiers: BillingTier[]): BillingResult {
  if (input.billingPeriodEnd < input.billingPeriodStart) throw new Error('Billing period end cannot precede its start.');
  const sortedTiers = validateTariff(tariff, tiers, input.billingPeriodEnd);
  const consumption = calculateConsumption(input, Number(tariff.meter_rollover_value));
  const round = (value: number) => roundBillingValue(value, tariff.rounding_scale, tariff.rounding_mode);
  const items: BillingLineItem[] = [];
  const includedTier = sortedTiers.find((tier) => Number(tier.minimum_volume) === 0 && tier.maximum_volume !== null && Number(tier.rate_per_unit) === 0);
  const classification = tariff.customer_type === 'non_member' ? 'Non-member' : 'Member';
  let usageCharge = 0; let order = 1;
  for (const tier of sortedTiers) {
    const upper = tier.maximum_volume === null ? consumption : Math.min(consumption, Number(tier.maximum_volume));
    const quantity = Math.max(0, upper - Number(tier.minimum_volume));
    if (quantity <= 0) continue;
    const amount = round(quantity * Number(tier.rate_per_unit)); usageCharge += amount;
    if (amount > 0) {
      const rate = Number(tier.rate_per_unit);
      const includedLimit = includedTier?.maximum_volume === null || includedTier?.maximum_volume === undefined ? null : Number(includedTier.maximum_volume);
      const description = includedLimit !== null && Number(tier.minimum_volume) >= includedLimit
        ? `Additional ${billingNumber(quantity)} m3 x ${billingMoney(rate)}`
        : `Usage ${billingNumber(quantity)} m3 x ${billingMoney(rate)}`;
      items.push({ item_type: 'usage', description, quantity, unit_price: rate, amount, sort_order: order++, calculation_snapshot: { minimum_volume: Number(tier.minimum_volume), maximum_volume: tier.maximum_volume === null ? null : Number(tier.maximum_volume) } });
    }
  }
  usageCharge = round(usageCharge);
  const fixedCharges = round(Number(tariff.fixed_charge));
  if (fixedCharges) {
    const includedLimit = includedTier?.maximum_volume === null || includedTier?.maximum_volume === undefined ? null : Number(includedTier.maximum_volume);
    const description = includedLimit === null ? 'Fixed service charge' : `${classification} minimum (0-${billingNumber(includedLimit)} m3)`;
    items.unshift({ item_type: 'fixed_charge', description, quantity: 1, unit_price: fixedCharges, amount: fixedCharges, sort_order: 1, calculation_snapshot: includedLimit === null ? {} : { included_consumption_m3: includedLimit, customer_type: tariff.customer_type } });
    items.forEach((item, index) => { item.sort_order = index + 1; });
    order = items.length + 1;
  }
  const preMinimum = round(usageCharge + fixedCharges);
  const currentCharge = round(Math.max(preMinimum, Number(tariff.minimum_charge)));
  const minimumAdjustment = round(currentCharge - preMinimum);
  if (minimumAdjustment) items.push({ item_type: 'minimum_charge', description: 'Minimum charge adjustment', quantity: 1, unit_price: minimumAdjustment, amount: minimumAdjustment, sort_order: order++, calculation_snapshot: { configured_minimum: Number(tariff.minimum_charge) } });
  const percentageDiscount = round(currentCharge * Number(tariff.discount_rate));
  const subsidy = round(Math.min(Math.max(0, currentCharge - percentageDiscount), Number(tariff.subsidy_amount)));
  const discounts = round(percentageDiscount + subsidy);
  if (percentageDiscount) items.push({ item_type: 'discount', description: 'Tariff discount', quantity: 1, unit_price: -percentageDiscount, amount: -percentageDiscount, sort_order: order++, calculation_snapshot: { rate: Number(tariff.discount_rate) } });
  if (subsidy) items.push({ item_type: 'subsidy', description: 'Tariff subsidy', quantity: 1, unit_price: -subsidy, amount: -subsidy, sort_order: order++, calculation_snapshot: {} });
  const taxableCharge = round(Math.max(0, currentCharge - discounts));
  const taxes = round(taxableCharge * Number(tariff.tax_rate));
  if (taxes) items.push({ item_type: 'tax', description: tariff.tax_name, quantity: 1, unit_price: Number(tariff.tax_rate), amount: taxes, sort_order: order++, calculation_snapshot: { taxable_charge: taxableCharge, rate: Number(tariff.tax_rate) } });
  const previousBalance = tariff.apply_previous_balance ? round(input.previousBalance ?? 0) : 0;
  assertFiniteNonnegative(previousBalance, 'Previous balance');
  if (previousBalance) items.push({ item_type: 'previous_balance', description: 'Previous unpaid balance', quantity: 1, unit_price: previousBalance, amount: previousBalance, sort_order: order++, calculation_snapshot: {} });
  const penaltyEligible = previousBalance > 0 && (input.previousBalanceAgeDays ?? 0) > tariff.penalty_grace_days;
  const penalties = penaltyEligible ? round(previousBalance * Number(tariff.penalty_rate)) : 0;
  if (penalties) items.push({ item_type: 'penalty', description: 'Overdue balance penalty', quantity: 1, unit_price: Number(tariff.penalty_rate), amount: penalties, sort_order: order++, calculation_snapshot: { previous_balance: previousBalance, grace_days: tariff.penalty_grace_days } });
  const totalAmount = round(Math.max(0, taxableCharge + taxes + previousBalance + penalties));
  return {
    consumption: roundBillingValue(consumption, 3, tariff.rounding_mode), subtotal: usageCharge, fixedCharges, discounts, taxes, penalties, previousBalance, totalAmount,
    dueDate: addCalendarDays(input.billingPeriodEnd, tariff.due_days), items,
    tariffSnapshot: { tariff: { ...tariff }, tiers: sortedTiers.map((tier) => ({ ...tier })), input: { ...input }, calculation_order: 'tiers,fixed,minimum,discount,subsidy,tax,previous_balance,penalty', consumption },
  };
}

