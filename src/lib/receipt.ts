import type { ReceiptData, ReceiptLine } from 'react-native-receipt-printer';

export type ReceiptPaperWidth = 58 | 80;
export type ReceiptCharge = { description: string; amount: number };
export type WaterBillReceipt = {
  invoiceId?: string;
  invoiceNumber: string;
  issuedAt: string;
  billingPeriod: string;
  dueDate: string;
  customerName: string;
  accountNumber: string;
  serviceAddress: string;
  meterNumber: string;
  previousReading: number;
  currentReading: number;
  consumption: number;
  charges: ReceiptCharge[];
  currentCharges?: number;
  previousBalance?: number;
  totalAmount: number;
  status?: string;
  preview?: boolean;
  provisional?: boolean;
};

const money = (value: number) => `PHP ${value.toFixed(2)}`;
const reading = (value: number) => `${value.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')} m3`;

export function buildWaterBillReceipt(data: WaterBillReceipt, paperWidth: ReceiptPaperWidth): ReceiptData {
  const embeddedPreviousBalance = data.charges.find((charge) => charge.description.toLowerCase().includes('previous unpaid balance'))?.amount ?? 0;
  const previousBalance = data.previousBalance ?? embeddedPreviousBalance;
  const currentCharges = data.currentCharges ?? Math.max(0, data.totalAmount - previousBalance);
  const visibleCharges = data.charges.filter((charge) => !charge.description.toLowerCase().includes('previous unpaid balance'));
  const lines: ReceiptLine[] = [
    { type: 'text', content: 'NMMPC', align: 'center', size: 'large', bold: true },
    { type: 'text', content: 'NEW MURCIA MULTIPURPOSE COOPERATIVE', align: 'center', bold: true },
    { type: 'text', content: 'WATER SERVICE INVOICE', align: 'center', bold: true },
    ...(data.provisional ? [{ type: 'text' as const, content: 'PROVISIONAL - NOT A FINAL BILL', align: 'center' as const, bold: true }] : data.preview ? [{ type: 'text' as const, content: 'PREVIEW - NOT A FINAL BILL', align: 'center' as const, bold: true }] : []),
    { type: 'divider' },
    { type: 'text', preText: 'Invoice reference:', content: data.invoiceNumber, bold: true },
    { type: 'text', preText: 'Issued:', content: data.issuedAt },
    { type: 'text', preText: 'Period:', content: data.billingPeriod },
    { type: 'text', preText: 'Due:', content: data.dueDate, bold: true },
    { type: 'divider' },
    { type: 'text', content: data.customerName, bold: true },
    { type: 'text', preText: 'Account:', content: data.accountNumber },
    { type: 'text', content: data.serviceAddress },
    { type: 'text', preText: 'Meter:', content: data.meterNumber },
    { type: 'divider' },
    { type: 'text', preText: 'Previous:', content: reading(data.previousReading) },
    { type: 'text', preText: 'Current:', content: reading(data.currentReading) },
    { type: 'text', preText: 'Consumption:', content: reading(data.consumption), bold: true },
    { type: 'divider' },
    ...visibleCharges.map<ReceiptLine>((charge) => ({ type: 'text', preText: charge.description, content: money(charge.amount) })),
    { type: 'divider' },
    { type: 'text', preText: 'Current bill:', content: money(currentCharges), bold: true },
    { type: 'text', preText: 'Previous balance:', content: money(previousBalance), bold: previousBalance > 0 },
    { type: 'divider', char: '=' },
    { type: 'text', content: 'AMOUNT DUE', align: 'center', bold: true },
    { type: 'text', content: money(data.totalAmount), align: 'center', size: 'large', bold: true },
    ...(data.status ? [{ type: 'text' as const, preText: 'Status:', content: data.status.toUpperCase() }] : []),
    { type: 'spacer' },
    { type: 'barcode', data: data.invoiceNumber.slice(-14), height: 64, showText: true },
    { type: 'text', content: 'Please keep this receipt for your records.', align: 'center' },
    { type: 'spacer', lines: 3 },
    { type: 'cut' },
  ];
  return { paperWidth, printerProfile: 'generic', lines };
}

export function buildTestReceipt(paperWidth: ReceiptPaperWidth): ReceiptData {
  return {
    paperWidth,
    printerProfile: 'generic',
    lines: [
      { type: 'text', content: 'NMMPC', align: 'center', size: 'large', bold: true },
      { type: 'text', content: `${paperWidth} MM PRINTER TEST`, align: 'center', bold: true },
      { type: 'divider' },
      { type: 'text', content: 'Bluetooth connection: OK' },
      { type: 'text', content: 'ESC/POS text: OK' },
      { type: 'text', preText: 'Amount:', content: 'PHP 123.45' },
      { type: 'barcode', data: 'NMMPC-TEST', height: 64, showText: true },
      { type: 'spacer', lines: 3 },
      { type: 'cut' },
    ],
  };
}
