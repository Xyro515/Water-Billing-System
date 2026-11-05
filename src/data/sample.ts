export type Customer = {
  id: string;
  name: string;
  account: string;
  address: string;
  meter: string;
  previousReading: number;
  status: 'Due soon' | 'Overdue' | 'Paid';
  balance: number;
  readingStatus: 'Pending' | 'Completed';
  customerType: 'member' | 'non_member';
};

export const customers: Customer[] = [
  { id: '1', name: 'Maria Santos', account: 'AL-2026-0148', address: '12 Sampaguita St., Brgy. San Isidro', meter: 'WM-031-8821', previousReading: 184, status: 'Due soon', balance: 428.5, readingStatus: 'Pending', customerType: 'member' },
  { id: '2', name: 'Jose Reyes', account: 'AL-2026-0189', address: '44 Rizal Ave., Brgy. Mabini', meter: 'WM-031-9074', previousReading: 256, status: 'Overdue', balance: 765.0, readingStatus: 'Pending', customerType: 'non_member' },
  { id: '3', name: 'Elena Cruz', account: 'AL-2026-0204', address: '8 Acacia Rd., Brgy. Maligaya', meter: 'WM-032-0142', previousReading: 98, status: 'Paid', balance: 0, readingStatus: 'Completed', customerType: 'member' },
  { id: '4', name: 'Ramon Dela Peña', account: 'AL-2026-0217', address: '21 Narra St., Brgy. Pag-asa', meter: 'WM-032-0198', previousReading: 312, status: 'Due soon', balance: 394.25, readingStatus: 'Pending', customerType: 'member' },
];

export const employee = { id: 'EMP-1042', name: 'Carlo Mendoza', role: 'Meter Reader', route: 'San Isidro · Route 04' };

export const findCustomer = (id?: string) => customers.find((item) => item.id === id) ?? customers[0];

export const readingDraft = {
  current: 197,
  consumption: 13,
  rate: 26.5,
  usageCharge: 344.5,
  serviceFee: 85,
  discount: 0,
  total: 429.5,
  period: 'October 1–31, 2026',
  dueDate: 'November 15, 2026',
};
