import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { ScreenHeader, ScreenState } from '../../components/ui';
import { findAssignedCustomerByQr } from '../../services/customers';
import { colors, radii, spacing } from '../../theme/tokens';
import { useAuth } from '../../contexts/auth';
import { buildMeterScanDestination } from '../../lib/meterScan';
import { SmoothPressable as Pressable } from '../../components/SmoothPressable';

export default function MeterScannerScreen() {
  const { session } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleScan = async ({ data }: BarcodeScanningResult) => {
    if (processing) return;
    setProcessing(true); setError(null);
    try {
      if (!session?.user.id) throw new Error('A signed-in employee is required.');
      const result = await findAssignedCustomerByQr(data, session.user.id);
      if (!result) { setError('This QR code does not match an active meter assigned to you.'); setProcessing(false); return; }
      router.replace(buildMeterScanDestination({ customerId: result.customerId, meterId: result.meter.id }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The meter could not be verified.'); setProcessing(false); }
  };
  if (!permission) return <SafeAreaView style={styles.safe}><ScreenHeader back backTarget="/customers" title="Scan meter QR" /><ScreenState loading title="Checking camera" message="Preparing the secure scanner." /></SafeAreaView>;
  if (!permission.granted) return <SafeAreaView style={styles.safe}><ScreenHeader back backTarget="/customers" title="Scan meter QR" /><ScreenState icon="camera-outline" title="Camera permission required" message="Allow camera access to scan the QR label on a water meter." actionLabel={permission.canAskAgain ? 'Allow camera' : 'Open settings'} onAction={() => permission.canAskAgain ? void requestPermission() : void Linking.openSettings()} /></SafeAreaView>;
  return <SafeAreaView style={styles.safe}><ScreenHeader back backTarget="/customers" title="Scan meter QR" subtitle="Verify an assigned meter" /><View style={styles.body}><CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={processing ? undefined : handleScan}><View style={styles.overlay}><View style={styles.frame} /><Text style={styles.guide}>Place the complete QR code inside the frame</Text></View></CameraView>{error ? <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => { setError(null); setProcessing(false); }} style={styles.retry}><Text style={styles.retryText}>Scan again</Text></Pressable></View> : null}{processing && !error ? <Text style={styles.processing}>Verifying meter assignment…</Text> : null}</View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.surface }, body: { flex: 1, backgroundColor: '#0A1715' }, camera: { flex: 1 }, overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }, frame: { width: 240, height: 240, borderWidth: 3, borderColor: colors.surface, borderRadius: radii.md }, guide: { color: colors.surface, fontWeight: '800', marginTop: spacing.lg, textAlign: 'center' }, error: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.lg, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface }, errorText: { color: colors.danger, lineHeight: 19 }, retry: { alignSelf: 'flex-end', marginTop: 10, padding: 8 }, retryText: { color: colors.primary, fontWeight: '900' }, processing: { position: 'absolute', bottom: spacing.lg, alignSelf: 'center', color: colors.surface, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.7)', padding: 12, borderRadius: radii.md } });
