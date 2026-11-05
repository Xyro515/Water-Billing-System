import { useRef, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { PrimaryButton, ScreenHeader, ScreenState, SecondaryButton } from './ui';
import { colors, radii, spacing } from '../theme/tokens';
import { analyzeMeterPhotoQuality } from '../services/photoQuality';
import { recognizeMeterPhoto, type MeterOcrResult } from '../services/meterOcr';
import type { PhotoQualityIssue, PhotoQualityResult } from '../lib/photoQuality';
import type { MeterRecognitionSuggestion } from '../lib/meterRecognition';
import { SmoothPressable as Pressable } from './SmoothPressable';

const qualityLabels: Record<PhotoQualityIssue, string> = {
  glare: 'Strong glare or reflection',
  low_light: 'Image is too dark',
  blur: 'Image may be blurred or out of focus',
};

export function MeterPhotoCapture({ customerName, meterNumber, onCancel, onCaptured }: {
  customerName: string;
  meterNumber: string;
  onCancel: () => void;
  onCaptured: (temporaryUri: string, recognition?: MeterRecognitionSuggestion) => Promise<void>;
}) {
  const camera = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [temporaryUri, setTemporaryUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<PhotoQualityResult | null>(null);
  const [qualityCheckFailed, setQualityCheckFailed] = useState(false);
  const [qualityConfirmed, setQualityConfirmed] = useState(false);
  const [recognition, setRecognition] = useState<MeterOcrResult | null>(null);
  const [recognitionConfirmed, setRecognitionConfirmed] = useState(false);

  const capture = async () => {
    if (!camera.current || !cameraReady || busy) return;
    setBusy(true);
    setError(null);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.7 });
      if (!picture?.uri) throw new Error('The camera did not return a photo.');
      setTemporaryUri(picture.uri);
      setQualityConfirmed(false);
      setQualityCheckFailed(false);
      setRecognition(null);
      setRecognitionConfirmed(false);
      try {
        setQuality(await analyzeMeterPhotoQuality(picture.uri));
      } catch {
        setQuality(null);
        setQualityCheckFailed(true);
      }
      setRecognition(await recognizeMeterPhoto({ uri: picture.uri, width: picture.width, height: picture.height }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The meter photo could not be captured.');
    } finally {
      setBusy(false);
    }
  };

  const savePhoto = async () => {
    if (!temporaryUri || busy) return;
    if ((qualityCheckFailed || quality?.issues.length) && !qualityConfirmed) {
      setError('Retake the photo or confirm that you inspected the meter digits.');
      return;
    }
    if (recognition?.status === 'recognized' && !recognitionConfirmed) {
      setError('Confirm or correct the recognized digits before continuing.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCaptured(temporaryUri, recognition?.status === 'recognized' ? recognition.suggestion : undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The meter photo could not be saved.');
      setBusy(false);
    }
  };

  const retake = () => {
    setTemporaryUri(null);
    setQuality(null);
    setQualityCheckFailed(false);
    setQualityConfirmed(false);
    setRecognition(null);
    setRecognitionConfirmed(false);
    setCameraReady(false);
  };

  if (!permission) return <SafeAreaView style={styles.safe}><ScreenHeader back title="Meter photo" /><ScreenState loading title="Checking camera" message="Preparing the camera for this identified meter." /></SafeAreaView>;
  if (!permission.granted) return <SafeAreaView style={styles.safe}><ScreenHeader title="Meter photo" /><ScreenState icon="camera-outline" title="Camera permission required" message={`Allow camera access to photograph meter ${meterNumber} for ${customerName}.`} actionLabel={permission.canAskAgain ? 'Allow camera' : 'Open settings'} onAction={() => permission.canAskAgain ? void requestPermission() : void Linking.openSettings()} /><View style={styles.permissionCancel}><SecondaryButton label="Cancel" onPress={onCancel} /></View></SafeAreaView>;

  const qualityNeedsReview = qualityCheckFailed || Boolean(quality?.issues.length);
  const recognitionNeedsConfirmation = recognition?.status === 'recognized' && !recognitionConfirmed;

  return <SafeAreaView style={styles.safe}><ScreenHeader title="Capture meter" subtitle={`${meterNumber} · ${customerName}`} /><View style={styles.cameraArea}>
    {temporaryUri ? <Image accessibilityLabel={`Preview of meter ${meterNumber}`} source={{ uri: temporaryUri }} resizeMode="cover" style={styles.camera} /> : <CameraView ref={camera} style={styles.camera} facing="back" mode="picture" onCameraReady={() => setCameraReady(true)} onMountError={(event) => setError(event.message)}><View style={styles.overlay}><View style={styles.frame}><View style={styles.digitWindow} /></View><Text style={styles.guide}>Center the meter face and digits inside the frame</Text></View></CameraView>}
    {temporaryUri && (qualityNeedsReview ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: qualityConfirmed }} onPress={() => setQualityConfirmed((value) => !value)} style={styles.qualityWarning}><Ionicons name={qualityConfirmed ? 'checkbox' : 'warning-outline'} size={23} color={colors.warning} /><View style={styles.reviewCopy}><Text style={styles.warningTitle}>Photo quality needs review</Text><Text style={styles.reviewText}>{qualityCheckFailed ? 'Automatic quality analysis was unavailable.' : quality?.issues.map((issue) => qualityLabels[issue]).join(' · ')} Retake the photo, or check this box only after the digits are readable.</Text></View></Pressable> : <View style={styles.review}><Ionicons name="checkmark-circle" size={22} color={colors.success} /><View style={styles.reviewCopy}><Text style={styles.reviewTitle}>Photo quality check passed</Text><Text style={styles.reviewText}>The image passed the glare, lighting, and focus heuristics. Confirm the meter digits before billing.</Text></View></View>)}
    {temporaryUri && recognition?.status === 'recognized' ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: recognitionConfirmed }} onPress={() => setRecognitionConfirmed((value) => !value)} style={styles.recognition}><Ionicons name={recognitionConfirmed ? 'checkbox' : 'scan-outline'} size={23} color={colors.primary} /><View style={styles.reviewCopy}><Text style={styles.recognitionTitle}>Suggested reading: {recognition.suggestion.wholeDigits}{recognition.suggestion.fractionalDigits ? ` · red ${recognition.suggestion.fractionalDigits}` : ''}</Text><Text style={styles.reviewText}>Confidence: {recognition.suggestion.confidence}. Check the physical meter, then confirm to copy these digits into the editable reading fields.</Text></View></Pressable> : null}
    {temporaryUri && recognition && recognition.status !== 'recognized' ? <View style={styles.manualFallback}><Ionicons name="create-outline" size={22} color={colors.inkMuted} /><View style={styles.reviewCopy}><Text style={styles.manualTitle}>Manual entry available</Text><Text style={styles.reviewText}>{recognition.message}</Text></View></View> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <View style={styles.actions}>{temporaryUri ? <><PrimaryButton label="Use photo" loading={busy} disabled={(qualityNeedsReview && !qualityConfirmed) || recognitionNeedsConfirmation} icon="checkmark" onPress={() => void savePhoto()} /><SecondaryButton label="Retake" icon="camera-reverse-outline" disabled={busy} onPress={retake} /></> : <PrimaryButton label="Capture photo" loading={busy} disabled={!cameraReady} icon="camera" onPress={() => void capture()} />}<Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable></View>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface }, cameraArea: { flex: 1, backgroundColor: '#071311' }, camera: { flex: 1 }, overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }, frame: { width: '88%', aspectRatio: 1.35, borderWidth: 3, borderColor: colors.surface, borderRadius: radii.md, justifyContent: 'center', paddingHorizontal: 24 }, digitWindow: { height: 66, borderWidth: 2, borderColor: colors.warning, borderRadius: radii.sm, backgroundColor: 'rgba(255,255,255,0.08)' }, guide: { color: colors.surface, fontWeight: '800', marginTop: spacing.lg, textAlign: 'center', paddingHorizontal: spacing.lg }, review: { flexDirection: 'row', gap: 10, padding: spacing.md, backgroundColor: '#E8F5ED' }, qualityWarning: { flexDirection: 'row', gap: 10, padding: spacing.md, backgroundColor: colors.warningSoft }, recognition: { flexDirection: 'row', gap: 10, padding: spacing.md, backgroundColor: colors.sky }, manualFallback: { flexDirection: 'row', gap: 10, padding: spacing.md, backgroundColor: colors.background }, reviewCopy: { flex: 1 }, reviewTitle: { color: colors.success, fontWeight: '900' }, warningTitle: { color: colors.warning, fontWeight: '900' }, recognitionTitle: { color: colors.primary, fontWeight: '900' }, manualTitle: { color: colors.ink, fontWeight: '900' }, reviewText: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 3 }, error: { color: colors.danger, backgroundColor: colors.surface, padding: spacing.sm, textAlign: 'center' }, actions: { padding: spacing.md, gap: 8, backgroundColor: colors.surface }, cancel: { minHeight: 42, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.inkMuted, fontWeight: '800' }, permissionCancel: { padding: spacing.md },
});
