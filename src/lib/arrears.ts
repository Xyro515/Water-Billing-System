export type OpenBill = { id: string; dueDate: string; balance: number };

export function allocatePaymentOldestFirst(bills: OpenBill[], payment: number) {
  if (!Number.isFinite(payment) || payment <= 0) throw new Error('Payment must be greater than zero.');
  const ordered = [...bills].filter((bill) => bill.balance > 0).sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id));
  const outstanding = ordered.reduce((sum, bill) => sum + bill.balance, 0);
  if (payment > outstanding + 0.001) throw new Error('Payment exceeds the outstanding balance.');
  let remaining = payment;
  const allocations: { billId: string; amount: number }[] = [];
  for (const bill of ordered) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, bill.balance);
    allocations.push({ billId: bill.id, amount: Math.round(amount * 100) / 100 });
    remaining = Math.round((remaining - amount) * 100) / 100;
  }
  return { allocations, outstanding, remainingBalance: Math.round((outstanding - payment) * 100) / 100 };
}
