import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Brand, PrimaryButton } from '../components/ui';
import { useAuth } from '../contexts/auth';
import { colors, radii, spacing } from '../theme/tokens';
import { SmoothPressable as Pressable } from '../components/SmoothPressable';

export default function LoginScreen() {
  const { signIn: authenticate } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hidden, setHidden] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  const signIn = async () => {
    const nextErrors: typeof errors = {};
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) nextErrors.email = 'Work email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) nextErrors.email = 'Enter a valid work email.';
    if (!password) nextErrors.password = 'Password is required.';
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    setLoading(true); setErrors({});
    const result = await authenticate(normalizedEmail, password);
    setLoading(false);
    if (result.error) {
      setErrors({ form: result.error });
      return;
    }
    router.replace('/dashboard');
  };

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.hero}><Brand /><Text maxFontSizeMultiplier={1.3} style={styles.title}>Welcome back</Text><Text style={styles.subtitle}>Sign in to manage meter readings and customer billing.</Text></View>
    <View style={styles.form}>
      <Text style={styles.label}>Work email</Text><TextInput accessibilityLabel="Work email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" autoCorrect={false} returnKeyType="next" value={email} onChangeText={(value) => { setEmail(value); setErrors((current) => ({ ...current, email: undefined, form: undefined })); }} placeholder="name@nmmpc.example" placeholderTextColor="#91A29F" style={[styles.input, errors.email && styles.inputError]} />{errors.email ? <Text accessibilityRole="alert" style={styles.error}>{errors.email}</Text> : null}
      <Text style={styles.label}>Password</Text><View style={[styles.passwordWrap, errors.password && styles.inputError]}><TextInput accessibilityLabel="Password" secureTextEntry={hidden} value={password} onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined, form: undefined })); }} onSubmitEditing={signIn} returnKeyType="done" placeholder="Enter password" placeholderTextColor="#91A29F" style={styles.passwordInput} /><Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'} onPress={() => setHidden((value) => !value)} hitSlop={10}><Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={21} color={colors.primary} /></Pressable></View>{errors.password ? <Text accessibilityRole="alert" style={styles.error}>{errors.password}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Forgot password" onPress={() => router.push('/forgot-password' as Href)} style={styles.forgot}><Text style={styles.forgotText}>Forgot password?</Text></Pressable>
      {errors.form ? <View accessibilityRole="alert" style={styles.formError}><Ionicons name="alert-circle-outline" size={19} color={colors.danger} /><Text style={styles.formErrorText}>{errors.form}</Text></View> : null}
      <PrimaryButton label="Sign in securely" loading={loading} onPress={signIn} />
      <View style={styles.demo}><Text style={styles.demoTitle}>AUTHORIZED ACCESS ONLY</Text><Text style={styles.demoText}>Use the work email assigned to your employee or administrator account.</Text></View>
    </View><Text style={styles.footer}>NMMPC Field App · Secure employee access</Text>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface }, flex: { flex: 1 }, content: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' }, hero: { marginBottom: 34 }, title: { color: colors.ink, fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 40 }, subtitle: { color: colors.inkMuted, fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 330 }, form: { gap: 9 }, label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 5 }, input: { minHeight: 54, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink, backgroundColor: colors.background }, inputError: { borderColor: colors.danger }, passwordWrap: { minHeight: 54, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background }, passwordInput: { flex: 1, minHeight: 52, fontSize: 16, color: colors.ink }, error: { color: colors.danger, fontSize: 11 }, forgot: { alignSelf: 'flex-end', paddingVertical: 6 }, forgotText: { color: colors.primary, fontWeight: '700', fontSize: 13 }, formError: { flexDirection: 'row', gap: 8, backgroundColor: '#FCE8E8', borderRadius: radii.sm, padding: 12 }, formErrorText: { flex: 1, color: colors.danger, fontSize: 11, lineHeight: 16 }, demo: { marginTop: 12, backgroundColor: colors.sky, borderRadius: radii.md, padding: spacing.md }, demoTitle: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, demoText: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 5 }, footer: { color: colors.inkMuted, textAlign: 'center', fontSize: 11, marginTop: 30 },
});
