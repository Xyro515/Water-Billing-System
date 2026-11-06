import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Card, PrimaryButton, ScreenHeader, ScreenState, SecondaryButton, WorkflowProgress } from '../../components/ui';
import { SmoothPressable } from '../../components/SmoothPressable';
import { useAuth } from '../../contexts/auth';
import { useOffline } from '../../contexts/offline';
import { calculateBill, type BillingInput, type BillingTariff, type BillingTier } from '../../lib/billing';
import { createOperationId } from '../../lib/operationId';
import { buildWaterBillReceipt, type WaterBillReceipt } from '../../lib/receipt';
import { loadApprovedTariffForCustomer, loadCustomerArrears, saveOfflineProvisionalReadingAndInvoice, saveReadingAndInvoice } from '../../services/billing';
import { DuplicatePrintError, loadInvoiceReceipt, printAuditedInvoiceReceipt, printReceiptData, type PrintProgress } from '../../services/receiptPrinter';
import { appStorage } from '../../services/storage';
import { offlineDatabaseEnabled } from '../../services/runtimeStorage';
import { classifySyncFailure, syncFailureMessage } from '../../lib/syncPolicy';
import { colors, radii, spacing } from '../../theme/tokens';

const REPRINT_REASONS = [
  { key: 'damaged', label: 'Damaged copy', value: 'Customer copy damaged' },
  { key: 'lost', label: 'Lost copy', value: 'Customer copy lost' },
  { key: 'unreadable', label: 'Unreadable print', value: 'Printer output unreadable' },
  { key: 'office', label: 'Office copy', value: 'Additional office file copy' },
] as const;
type ReprintReasonKey = typeof REPRINT_REASONS[number]['key'] | 'other';

export default function InvoiceScreen() {
  const { session } = useAuth();
  const { lastSynchronizedAt } = useOffline();
  const ownerId = session?.user.id;
  const params = useLocalSearchParams<{ id: string; invoiceId?: string; autoPrint?: string; current?: string; fractionalDigits?: string; condition?: 'normal' | 'rollover' | 'replaced'; capturedAt?: string; name?: string; account?: string; address?: string; meter?: string; meterId?: string; photoId?: string; photoPath?: string; previous?: string; customerType?: 'member' | 'non_member'; billingPeriodStart?: string; billingPeriodEnd?: string }>();
  const { id, current, condition = 'normal', invoiceId } = params;
  const previousReading = Number(params.previous);
  const currentReading = Number(current);
  const customer = { id, name: params.name ?? '', account: params.account ?? '', address: params.address ?? '', meter: params.meter ?? '', meterId: params.meterId, previousReading: Number.isFinite(previousReading) ? previousReading : 0, customerType: params.customerType };
  const billingPeriodStart = params.billingPeriodStart ?? '';
  const billingPeriodEnd = params.billingPeriodEnd ?? '';
  const workflowReady = Boolean(invoiceId || (session?.user.id && id && params.name && params.account && params.address && params.meter && params.meterId && params.customerType && params.capturedAt && billingPeriodStart && billingPeriodEnd && Number.isFinite(previousReading) && Number.isFinite(currentReading)));
  const readingOperationId = useRef(createOperationId()).current;
  const invoiceOperationId = useRef(createOperationId()).current;
  const autoPrintAttempted = useRef(false);
  const printInvoiceRef = useRef<() => Promise<void>>(async () => undefined);
  const [receipt, setReceipt] = useState<WaterBillReceipt | null>(null);
  const [tariffLabel, setTariffLabel] = useState('');
  const [billingSelection, setBillingSelection] = useState<{ tariff: BillingTariff; tiers: BillingTier[]; source: 'server' | 'cache' } | null>(null);
  const [arrearsSnapshot, setArrearsSnapshot] = useState({ previousBalance: 0, previousBalanceAgeDays: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState('');
  const [printCount, setPrintCount] = useState(0);
  const [showReprint, setShowReprint] = useState(false);
  const [reprintReasonKey, setReprintReasonKey] = useState<ReprintReasonKey>('damaged');
  const [customReprintReason, setCustomReprintReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const receiptKey = invoiceId ?? receipt?.invoiceNumber;

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (invoiceId) {
        const saved = await loadInvoiceReceipt(invoiceId, ownerId);
        if (active) { setReceipt(saved); setTariffLabel('Saved invoice tariff snapshot'); }
        return;
      }
      if (!workflowReady) throw new Error('The reading context is incomplete. Return to the assigned customer and reopen the active meter reading.');
      const [selected, arrears] = await Promise.all([loadApprovedTariffForCustomer(id, billingPeriodEnd, { ownerId: ownerId!, customerType: customer.customerType! }), loadCustomerArrears(id, billingPeriodStart)]);
      const previousBalanceAgeDays = arrears.oldestDueDate ? Math.max(0, Math.floor((new Date(`${billingPeriodEnd}T00:00:00Z`).getTime() - new Date(`${arrears.oldestDueDate}T00:00:00Z`).getTime()) / 86400000)) : 0;
      const input: BillingInput = { previousReading: customer.previousReading, currentReading, condition, replacementInitialReading: condition === 'replaced' ? 0 : undefined, billingPeriodStart, billingPeriodEnd, previousBalance: arrears.previousArrears, previousBalanceAgeDays };
      const calculation = calculateBill(input, selected.tariff, selected.tiers);
      if (!active) return;
      setBillingSelection({ tariff: selected.tariff, tiers: selected.tiers, source: selected.source });
      setArrearsSnapshot({ previousBalance: arrears.previousArrears, previousBalanceAgeDays });
      setTariffLabel(`${selected.tariff.name} · v${selected.tariff.version}${selected.source === 'cache' ? ' · cached' : ''}`);
      setReceipt({
        invoiceNumber: `${selected.source === 'cache' ? 'PROVISIONAL' : 'PREVIEW'}-${customer.account}`.slice(0, 28), issuedAt: new Date().toISOString(), billingPeriod: `${billingPeriodStart} to ${billingPeriodEnd}`, dueDate: calculation.dueDate,
        customerName: customer.name, accountNumber: customer.account, serviceAddress: customer.address, meterNumber: customer.meter,
        previousReading: customer.previousReading, currentReading, consumption: calculation.consumption,
        charges: calculation.items.map((item) => ({ description: item.description, amount: item.amount })), currentCharges: calculation.totalAmount - calculation.previousBalance, previousBalance: calculation.previousBalance, totalAmount: calculation.totalAmount, status: selected.source === 'cache' ? 'provisional' : 'draft', preview: selected.source === 'server', provisional: selected.source === 'cache',
      });
    };
    void load().catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : 'Unable to calculate the invoice preview.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [billingPeriodEnd, billingPeriodStart, condition, currentReading, customer.account, customer.address, customer.customerType, customer.meter, customer.name, customer.previousReading, id, invoiceId, lastSynchronizedAt, ownerId, workflowReady]);
  useEffect(() => { if (receiptKey) appStorage.getPrintedReceipt(receiptKey).then((record) => setPrintCount(record?.printCount ?? 0)); }, [receiptKey]);
  useFocusEffect(useCallback(() => {
    if (!invoiceId) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { router.dismissTo('/customers'); return true; });
    return () => subscription.remove();
  }, [invoiceId]));

  const describeProgress = (progress: PrintProgress) => progress.status === 'sending' ? 'Sending receipt to printer...' : progress.status === 'done' ? 'Receipt sent successfully.' : progress.status === 'error' ? progress.error.message : 'Preparing receipt...';
  const saveInvoice = async (printAfterSave = false) => {
    if (!workflowReady || !session?.user.id || !customer.meterId || !params.capturedAt || !receipt || !billingSelection) return;
    setIsSaving(true);
    try {
      const input: BillingInput = { previousReading: customer.previousReading, currentReading, condition, replacementInitialReading: condition === 'replaced' ? 0 : undefined, billingPeriodStart, billingPeriodEnd, ...arrearsSnapshot };
      const saveProvisional = async () => saveOfflineProvisionalReadingAndInvoice({ customerId: id, meterId: customer.meterId!, employeeId: session.user.id, capturedAt: params.capturedAt!, condition, photoPath: params.photoPath, fractionalDigits: params.fractionalDigits, input, readingOperationId, invoiceOperationId, tariff: billingSelection.tariff, tiers: billingSelection.tiers, receipt });
      let targetInvoiceId: string;
      let autoPrintAllowed = true;
      if (billingSelection.source === 'cache') {
        const provisional = await saveProvisional(); targetInvoiceId = provisional.provisionalInvoiceId; autoPrintAllowed = true;
      } else {
        try {
          const created = await saveReadingAndInvoice({ customerId: id, meterId: customer.meterId, employeeId: session.user.id, capturedAt: params.capturedAt, condition, photoPath: params.photoPath, fractionalDigits: params.fractionalDigits, input, readingOperationId, invoiceOperationId });
          targetInvoiceId = created.invoice.id;
          if (offlineDatabaseEnabled) {
            const { saveOfflineInvoiceReceipt } = await import('../../services/offline-database');
            await saveOfflineInvoiceReceipt(session.user.id, id, created.invoice.id, created.invoice.status, { ...receipt, invoiceId: created.invoice.id, invoiceNumber: created.invoice.invoice_number, issuedAt: created.invoice.issued_at, status: created.invoice.status, preview: false, provisional: false });
          }
        } catch (reason) {
          if (classifySyncFailure(syncFailureMessage(reason)) !== 'transient') throw reason;
          const provisional = await saveProvisional(); targetInvoiceId = provisional.provisionalInvoiceId; autoPrintAllowed = true;
        }
      }
      await appStorage.removeReadingDraft(id);
      if (offlineDatabaseEnabled) {
        const { removeOfflineReadingDraft } = await import('../../services/offline-database');
        await removeOfflineReadingDraft(session.user.id, id);
      }
      const preferences = await appStorage.getPrinterPreferences();
      const virtualMode = preferences?.printerMode === 'virtual';
      const printerConfigured = Boolean(virtualMode ? preferences?.virtualPrinterUrl : preferences?.savedPrinter);
      const autoPrintReady = Boolean(autoPrintAllowed && (printAfterSave || (printerConfigured && preferences?.autoPrint)));
      router.replace({ pathname: '/invoice/[id]', params: { id, invoiceId: targetInvoiceId, autoPrint: autoPrintReady ? '1' : undefined } });
    } catch (error) {
      Alert.alert('Unable to save invoice', error instanceof Error ? error.message : 'The reading and invoice could not be saved. Try again.');
    } finally {
      setIsSaving(false);
    }
  };
  const printInvoice = async () => {
    if (!receipt || !invoiceId) return;
    const isReprint = printCount > 0;
    if (isReprint && !showReprint) { setShowReprint(true); return; }
    const reprintReason = reprintReasonKey === 'other' ? customReprintReason.trim() : REPRINT_REASONS.find((reason) => reason.key === reprintReasonKey)?.value ?? '';
    if (isReprint && reprintReason.length < 5) { Alert.alert('Reason required', 'Select a reprint reason or enter a custom reason of at least five characters.'); return; }
    const preferences = await appStorage.getPrinterPreferences();
    const virtualMode = preferences?.printerMode === 'virtual';
    if (!preferences || (virtualMode ? !preferences.virtualPrinterUrl : !preferences.savedPrinter)) { Alert.alert('Printer required', 'Configure a Bluetooth or Windows virtual printer from Printer settings first.', [{ text: 'Open Printer settings', onPress: () => router.push('/printer') }, { text: 'Cancel' }]); return; }
    const printerName = virtualMode ? 'Windows virtual printer' : preferences.savedPrinter?.name ?? 'Bluetooth printer';
    setIsPrinting(true); setPrintStatus('Preparing receipt...');
    const printOptions = { printerAddress: virtualMode ? undefined : preferences.savedPrinter?.address, virtualPrinterUrl: virtualMode ? preferences.virtualPrinterUrl : undefined, onProgress: (progress: PrintProgress) => setPrintStatus(describeProgress(progress)) };
    try {
      const document = buildWaterBillReceipt(receipt, preferences.paperWidth);
      if (receipt.provisional) await printReceiptData(document, printOptions);
      else await printAuditedInvoiceReceipt(document, { ...printOptions, invoiceId: receipt.invoiceId ?? invoiceId, isReprint, reprintReason: isReprint ? reprintReason.trim() : undefined, printerName });
      const record = await appStorage.recordPrintedReceipt(invoiceId);
      setPrintCount(record.printCount); setShowReprint(false); setReprintReasonKey('damaged'); setCustomReprintReason('');
      Alert.alert(isReprint ? 'Reprint sent' : 'Receipt sent', `${preferences.paperWidth} mm receipt sent to ${printerName}.`);
    } catch (error) {
      if (error instanceof DuplicatePrintError) setShowReprint(true);
      const message = error instanceof Error ? error.message : 'Unable to print the receipt.';
      setPrintStatus(message); Alert.alert('Printing failed', message);
    } finally { setIsPrinting(false); }
  };
  useEffect(() => { printInvoiceRef.current = printInvoice; });
  useEffect(() => {
    if (params.autoPrint !== '1' || !invoiceId || !receipt || autoPrintAttempted.current) return;
    autoPrintAttempted.current = true;
    void printInvoiceRef.current();
  }, [invoiceId, params.autoPrint, receipt]);

  if (loading) return <SafeAreaView style={styles.safe}><ScreenHeader back={!invoiceId} backTarget="/customers" title={invoiceId ? 'Invoice' : 'Invoice preview'} /><ScreenState loading title={invoiceId ? 'Loading invoice' : 'Calculating invoice'} message={invoiceId ? 'Loading the saved invoice and print status.' : 'Selecting the approved tariff and calculating itemized charges.'} /></SafeAreaView>;
  if (!receipt || loadError) return <SafeAreaView style={styles.safe}><ScreenHeader back={!invoiceId} backTarget="/customers" title={invoiceId ? 'Invoice' : 'Invoice preview'} /><ScreenState icon="alert-circle-outline" title={invoiceId ? 'Invoice unavailable' : 'Preview unavailable'} message={loadError ?? 'The invoice could not be calculated.'} actionLabel={invoiceId ? 'Choose another customer' : 'Go back'} onAction={() => invoiceId ? router.replace('/customers') : router.back()} /></SafeAreaView>;
  const embeddedPreviousBalance = receipt.charges.find((charge) => charge.description.toLowerCase().includes('previous unpaid balance'))?.amount ?? 0;
  const previousBalance = receipt.previousBalance ?? embeddedPreviousBalance;
  const currentCharges = receipt.currentCharges ?? Math.max(0, receipt.totalAmount - previousBalance);
  const visibleCharges = receipt.charges.filter((charge) => !charge.description.toLowerCase().includes('previous unpaid balance'));

  return <SafeAreaView style={styles.safe}><ScreenHeader back={!invoiceId} backTarget="/customers" title={receipt.provisional ? 'Provisional statement' : invoiceId ? 'Invoice' : 'Invoice preview'} subtitle={receipt.provisional ? 'Waiting for synchronization' : invoiceId ? 'Saved and ready to print' : 'Review before saving'} /><ScrollView contentContainerStyle={styles.content}>
    <WorkflowProgress current={3} />
    <View style={styles.success}><View style={styles.check}><Ionicons name="checkmark" size={20} color={colors.surface} /></View><View style={styles.successCopy}><Text style={styles.successTitle}>{invoiceId ? 'Invoice saved' : 'Reading verified'}</Text><Text style={styles.successText}>{invoiceId ? 'Print the receipt, then continue to the next customer.' : 'Review the calculation, then save the reading and invoice.'}</Text></View></View>
    <Card style={styles.invoice}><View style={styles.invoiceHead}><View><Text style={styles.brand}>NMMPC</Text><Text style={styles.invoiceLabel}>{receipt.provisional ? 'PROVISIONAL WATER STATEMENT' : 'WATER SERVICE INVOICE'}</Text></View><View style={styles.draft}><Text style={styles.draftText}>{receipt.provisional ? 'NOT FINAL' : receipt.preview ? 'PREVIEW' : receipt.status?.toUpperCase()}</Text></View></View><View style={styles.divider} /><View style={styles.invoiceReference}><Text style={styles.invoiceReferenceLabel}>INVOICE REFERENCE</Text><Text selectable style={styles.invoiceReferenceValue}>{receipt.invoiceNumber}</Text></View>
      <Text style={styles.customer}>{receipt.customerName}</Text><Text style={styles.meta}>{receipt.accountNumber}</Text><Text style={styles.meta}>{receipt.serviceAddress}</Text><Text style={styles.tariff}>{tariffLabel}</Text>
      <View style={styles.readingRow}><Reading label="Previous" value={`${receipt.previousReading} m³`} /><Reading label="Current" value={`${receipt.currentReading} m³`} /><Reading label="Usage" value={`${receipt.consumption} m³`} accent /></View>
      <Text style={styles.section}>BILLING SUMMARY</Text>{visibleCharges.map((charge, index) => <Line key={`${charge.description}-${index}`} label={charge.description} value={`₱${charge.amount.toFixed(2)}`} />)}<View style={styles.balanceSummary}><Line label="Current bill" value={`₱${currentCharges.toFixed(2)}`} /><Line label="Previous balance" value={`₱${previousBalance.toFixed(2)}`} /></View><View style={styles.totalRow}><Text style={styles.totalLabel}>Total amount due</Text><Text style={styles.total}>₱{receipt.totalAmount.toFixed(2)}</Text></View>
      <View style={styles.dates}><View><Text style={styles.dateLabel}>BILLING PERIOD</Text><Text style={styles.dateValue}>{receipt.billingPeriod}</Text></View><View><Text style={styles.dateLabel}>DUE DATE</Text><Text style={styles.dateValue}>{receipt.dueDate}</Text></View></View>
    </Card>
    <View style={styles.notice}><Text style={styles.noticeTitle}>{receipt.provisional ? 'Provisional — not a final bill' : receipt.preview ? 'Unsaved preview' : 'Saved invoice'}</Text><Text style={styles.noticeText}>{receipt.provisional ? 'This statement was calculated from an approved cached tariff. It will become a saved invoice after synchronization confirms the reading, tariff, and billing period.' : receipt.preview ? 'Save this confirmed reading and invoice before printing. The same operation IDs are reused safely if a network retry is needed.' : 'Every print attempt and reason-controlled reprint is recorded in the audit log.'}</Text></View>
    {showReprint ? <Card><Text style={styles.reprintTitle}>Controlled reprint</Text><Text style={styles.noticeText}>This receipt has already printed {printCount} time(s). Select the reason for another copy. Damaged copy is selected by default.</Text><View accessibilityRole="radiogroup" style={styles.reasonOptions}>{REPRINT_REASONS.map((reason) => { const selected = reprintReasonKey === reason.key; return <SmoothPressable accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={reason.value} key={reason.key} onPress={() => setReprintReasonKey(reason.key)} style={[styles.reasonOption, selected && styles.reasonOptionSelected]}><Text style={[styles.reasonOptionText, selected && styles.reasonOptionTextSelected]}>{reason.label}</Text></SmoothPressable>; })}<SmoothPressable accessibilityRole="radio" accessibilityState={{ checked: reprintReasonKey === 'other' }} accessibilityLabel="Other reprint reason" onPress={() => setReprintReasonKey('other')} style={[styles.reasonOption, reprintReasonKey === 'other' && styles.reasonOptionSelected]}><Text style={[styles.reasonOptionText, reprintReasonKey === 'other' && styles.reasonOptionTextSelected]}>Other</Text></SmoothPressable></View>{reprintReasonKey === 'other' ? <TextInput accessibilityLabel="Custom reprint reason" value={customReprintReason} onChangeText={setCustomReprintReason} placeholder="Enter the operational reason" multiline style={styles.reasonInput} /> : <View style={styles.selectedReason}><Ionicons name="checkmark-circle-outline" size={17} color={colors.success} /><Text style={styles.selectedReasonText}>{REPRINT_REASONS.find((reason) => reason.key === reprintReasonKey)?.value}</Text></View>}</Card> : null}
    {printStatus ? <Text accessibilityLiveRegion="polite" style={styles.printStatus}>{printStatus}</Text> : null}
    <View style={styles.actions}>{invoiceId ? <><PrimaryButton icon="print-outline" label={isPrinting ? 'Printing...' : printCount > 0 ? 'Reprint receipt' : 'Print invoice receipt'} disabled={isPrinting} onPress={printInvoice} /><SecondaryButton icon="arrow-forward-circle-outline" label="Finish and choose next customer" onPress={() => router.dismissTo('/customers')} /></> : <><PrimaryButton icon="print-outline" label={isSaving ? 'Saving...' : 'Save and print invoice'} disabled={isSaving} onPress={() => void saveInvoice(true)} /><SecondaryButton icon="save-outline" label="Save without printing" disabled={isSaving} onPress={() => void saveInvoice(false)} /><SecondaryButton icon="create-outline" label="Edit reading" disabled={isSaving} onPress={() => router.replace({ pathname: '/reading/[id]', params: { id: customer.id, name: customer.name, account: customer.account, address: customer.address, meter: customer.meter, meterId: customer.meterId, previous: String(customer.previousReading), customerType: customer.customerType, billingPeriodStart, billingPeriodEnd } })} /></>}</View>
  </ScrollView></SafeAreaView>;
}

function Reading({ label, value, accent }: { label: string; value: string; accent?: boolean }) { return <View style={styles.reading}><Text style={styles.readingLabel}>{label}</Text><Text style={[styles.readingValue, accent && styles.accent]}>{value}</Text></View>; }
function Line({ label, value }: { label: string; value: string }) { return <View style={styles.line}><Text style={styles.lineLabel}>{label}</Text><Text style={styles.lineValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface }, content: { padding: spacing.md, gap: spacing.md, backgroundColor: colors.background }, success: { backgroundColor: colors.primarySoft, borderRadius: radii.md, padding: 14, flexDirection: 'row', alignItems: 'center' }, check: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, successCopy: { marginLeft: 11 }, successTitle: { color: colors.primaryDark, fontWeight: '900', fontSize: 13 }, successText: { color: colors.inkMuted, fontSize: 10, marginTop: 3 }, invoice: { padding: 20 }, invoiceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, brand: { color: colors.primary, fontSize: 21, fontWeight: '900' }, invoiceLabel: { color: colors.inkMuted, fontSize: 8, fontWeight: '800', letterSpacing: 1.3, marginTop: 3 }, draft: { backgroundColor: colors.warningSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }, draftText: { color: colors.warning, fontSize: 9, fontWeight: '900' }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 16 }, invoiceReference: { backgroundColor: colors.primarySoft, borderRadius: radii.sm, padding: 11, marginBottom: 14 }, invoiceReferenceLabel: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, invoiceReferenceValue: { color: colors.primaryDark, fontSize: 12, fontWeight: '900', marginTop: 4 }, customer: { color: colors.ink, fontSize: 16, fontWeight: '900' }, meta: { color: colors.inkMuted, fontSize: 10, marginTop: 4 }, tariff: { color: colors.primary, fontSize: 10, fontWeight: '800', marginTop: 8 }, readingRow: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radii.sm, marginTop: 16, paddingVertical: 13 }, reading: { flex: 1, alignItems: 'center' }, readingLabel: { color: colors.inkMuted, fontSize: 9 }, readingValue: { color: colors.ink, fontSize: 12, fontWeight: '900', marginTop: 4 }, accent: { color: colors.primary }, section: { color: colors.inkMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1.3, marginTop: 21, marginBottom: 8 }, line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 12 }, lineLabel: { color: colors.inkMuted, fontSize: 11, flex: 1 }, lineValue: { color: colors.ink, fontSize: 11, fontWeight: '700' }, balanceSummary: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 7, paddingTop: 7 }, totalRow: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 7, paddingTop: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, totalLabel: { color: colors.ink, fontSize: 15, fontWeight: '900' }, total: { color: colors.primary, fontSize: 24, fontWeight: '900' }, dates: { marginTop: 18, backgroundColor: colors.sky, borderRadius: radii.sm, padding: 12, gap: 12 }, dateLabel: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, dateValue: { color: colors.ink, fontSize: 10, fontWeight: '700', marginTop: 3 }, notice: { backgroundColor: '#FFF8E9', borderRadius: radii.md, padding: 14 }, noticeTitle: { color: colors.warning, fontSize: 11, fontWeight: '900' }, noticeText: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: 4 }, reprintTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' }, reasonOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, reasonOption: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.surface }, reasonOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, reasonOptionText: { color: colors.inkMuted, fontSize: 10, fontWeight: '800' }, reasonOptionTextSelected: { color: colors.primaryDark }, selectedReason: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, borderRadius: radii.sm, backgroundColor: colors.background, padding: 11 }, selectedReasonText: { color: colors.ink, fontSize: 10, fontWeight: '700' }, reasonInput: { marginTop: 12, minHeight: 72, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, padding: 12, color: colors.ink, textAlignVertical: 'top' }, printStatus: { color: colors.inkMuted, fontSize: 11, textAlign: 'center' }, actions: { gap: 10, paddingBottom: 8 },
});
