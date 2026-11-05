import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Brand, PrimaryButton, SecondaryButton } from '../components/ui';
import { supabase } from '../lib/supabase';
import { colors, radii, spacing } from '../theme/tokens';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid work email.');
      return;
    }

    setLoading(true);
    setError(null);
    const redirectTo = Linking.createURL('reset-password');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    // Use the same response whether an account exists to avoid disclosing users.
    setMessage('If that address belongs to an active account, a secure reset link has been sent.');
  };

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Brand />
    <View style={styles.copy}><Text style={styles.title}>Reset your password</Text><Text style={styles.subtitle}>Enter your work email. The link in the email will return you to NMMPC to choose a new password.</Text></View>
    <View style={styles.form}>
      <Text style={styles.label}>Work email</Text>
      <TextInput accessibilityLabel="Work email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={(value) => { setEmail(value); setError(null); setMessage(null); }} placeholder="name@nmmpc.example" placeholderTextColor="#91A29F" style={[styles.input, error && styles.inputError]} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
      <PrimaryButton label="Send secure reset link" loading={loading} onPress={requestReset} />
      <SecondaryButton label="Back to sign in" onPress={() => router.replace('/')} />
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface }, flex: { flex: 1 }, content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg }, copy: { marginVertical: 36 }, title: { color: colors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -0.8 }, subtitle: { color: colors.inkMuted, fontSize: 15, lineHeight: 23, marginTop: 10 }, form: { gap: 12 }, label: { color: colors.ink, fontSize: 13, fontWeight: '800' }, input: { minHeight: 54, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink, backgroundColor: colors.background }, inputError: { borderColor: colors.danger }, error: { color: colors.danger, fontSize: 12 }, success: { color: colors.success, backgroundColor: '#E8F5ED', padding: 12, borderRadius: radii.sm, fontSize: 12, lineHeight: 18 },
});
