import type { CustomerType } from '../types/database.types';

export const INCLUDED_CONSUMPTION_M3 = 10;
export const EXCESS_RATE_PER_M3 = 15;
export const CUSTOMER_BASE_CHARGE: Record<CustomerType, number> = {
  member: 150,
  non_member: 200,
};

export function customerTariffCode(customerType: CustomerType) {
  return customerType === 'member' ? 'MEMBER_RESIDENTIAL' : 'NON_MEMBER_RESIDENTIAL';
}

export function calculateMembershipCharge(customerType: CustomerType, consumption: number) {
  if (!Number.isFinite(consumption) || consumption < 0) throw new Error('Consumption must be a non-negative number.');
  const baseCharge = CUSTOMER_BASE_CHARGE[customerType];
  const excessConsumption = Math.max(0, consumption - INCLUDED_CONSUMPTION_M3);
  const excessCharge = excessConsumption * EXCESS_RATE_PER_M3;
  return { baseCharge, excessConsumption, excessCharge, total: baseCharge + excessCharge };
}
