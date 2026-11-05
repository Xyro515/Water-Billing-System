import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Brand, PrimaryButton, SecondaryButton } from '../components/ui';
import { supabase } from '../lib/supabase';
import { colors, radii, spacing } from '../theme/tokens';

function getAuthTokens(url: string) {
  const parameterString = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
  if (!parameterString) return null;
  const parameters = new URLSearchParams(parameterString);
  const accessToken = parameters.get('access_token');
  const refreshToken = parameters.get('refresh_token');
  return accessToken && refreshToken ? { access_token: accessToken, refresh_token: refreshToken } : null;
}

export default function ResetPasswordScreen() {
  const url = Linking.useLinkingURL();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [preparing, setPreparing] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prepare = async () => {
      if (url) {
        const tokens = getAuthTokens(url);
        if (tokens) {
          const { error: sessionError } = await supabase.auth.setSession(tokens);
          if (sessionError) setError('This password reset link is invalid or has expired.');
        }
      }
      const { data } = await supabase.auth.getSession();
      setCanReset(!!data.session);
      if (!data.session) setError('Open this screen from the latest password reset email.');
      setPreparing(false);
    };
    void prepare();
  }, [url]);

  const updatePassword = async () => {
    if (password.length < 12) {
      setError('Use at least 12 characters for your new password.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    await supabase.auth.signOut({ scope: 'local' });
    setLoading(false);
    router.replace('/');
  };

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Brand />
    <View style={styles.copy}><Text style={styles.title}>Choose a new password</Text><Text style={styles.subtitle}>Create a unique password with at least 12 characters.</Text></View>
    <View style={styles.form}>
      <Text style={styles.label}>New password</Text>
      <TextInput accessibilityLabel="New password" autoComplete="new-password" secureTextEntry value={password} onChangeText={(value) => { setPassword(value); setError(null); }} placeholder="At least 12 characters" placeholderTextColor="#91A29F" style={[styles.input, error && styles.inputError]} />
      <Text style={styles.label}>Confirm new password</Text>
      <TextInput accessibilityLabel="Confirm new password" autoComplete="new-password" secureTextEntry value={confirmation} onChangeText={(value) => { setConfirmation(value); setError(null); }} onSubmitEditing={updatePassword} placeholder="Repeat your new password" placeholderTextColor="#91A29F" style={[styles.input, error && styles.inputError]} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <PrimaryButton disabled={preparing || !canReset} label={preparing ? 'Verifying reset link…' : 'Update password'} loading={loading} onPress={updatePassword} />
      <SecondaryButton label="Return to sign in" onPress={async () => { await supabase.auth.signOut({ scope: 'local' }); router.replace('/'); }} />
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface }, flex: { flex: 1 }, content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg }, copy: { marginVertical: 36 }, title: { color: colors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -0.8 }, subtitle: { color: colors.inkMuted, fontSize: 15, lineHeight: 23, marginTop: 10 }, form: { gap: 12 }, label: { color: colors.ink, fontSize: 13, fontWeight: '800' }, input: { minHeight: 54, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink, backgroundColor: colors.background }, inputError: { borderColor: colors.danger }, error: { color: colors.danger, backgroundColor: '#FCE8E8', padding: 12, borderRadius: radii.sm, fontSize: 12, lineHeight: 18 },
});
