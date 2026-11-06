import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Card, PrimaryButton, ScreenHeader } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { colors, radii, spacing } from '../../../theme/tokens';

export default function ReplaceMeterScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const [serial, setSerial] = useState(''); const [manufacturer, setManufacturer] = useState(''); const [model, setModel] = useState(''); const [initialReading, setInitialReading] = useState('0'); const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const replace = async () => {
    const reading = Number(initialReading);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Use YYYY-MM-DD for the replacement date.'); return; }
    if (!Number.isFinite(reading) || reading < 0) { setError('Initial reading must be zero or greater.'); return; }
    setLoading(true); setError(null);
    const result = await supabase.rpc('replace_customer_meter', { target_customer_id: customerId, new_serial_number: serial.trim() || null, new_manufacturer: manufacturer.trim() || null, new_model: model.trim() || null, replacement_date: date, new_initial_reading: reading });
    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
    Alert.alert('Meter replaced', 'The previous assignment was closed and the new meter is active.', [{ text: 'View account', onPress: () => router.replace({ pathname: '/customers/[id]', params: { id: customerId } }) }]);
  };
  return <SafeAreaView style={styles.safe}><ScreenHeader back title="Replace meter" subtitle="Administrator workflow" /><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Card><Text style={styles.notice}>This atomic operation closes the current assignment, marks the old meter as replaced, and activates the new meter. Its permanent NMMPC meter number is generated automatically.</Text></Card><Field label="Serial number" value={serial} onChange={setSerial} placeholder="Manufacturer serial" /><Field label="Manufacturer" value={manufacturer} onChange={setManufacturer} placeholder="Optional" /><Field label="Model" value={model} onChange={setModel} placeholder="Optional" /><Field label="Replacement date" value={date} onChange={setDate} placeholder="YYYY-MM-DD" /><Field label="Initial reading (m³)" value={initialReading} onChange={setInitialReading} placeholder="0" numeric />{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<PrimaryButton label="Confirm meter replacement" icon="swap-horizontal-outline" loading={loading} onPress={() => void replace()} /></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
function Field({ label, value, onChange, placeholder, numeric }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; numeric?: boolean }) { return <><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} keyboardType={numeric ? 'decimal-pad' : 'default'} autoCapitalize="characters" style={styles.input} /></>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.surface }, flex: { flex: 1 }, content: { padding: spacing.md, gap: 8, backgroundColor: colors.background }, notice: { color: colors.inkMuted, lineHeight: 19 }, label: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 7 }, input: { minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.ink }, error: { color: colors.danger, marginVertical: 8 } });
