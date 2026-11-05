import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/auth';
import { OfflineProvider } from '../contexts/offline';
import { ScreenState } from '../components/ui';
import { colors } from '../theme/tokens';

export default function RootLayout() {
  return (
    <AuthProvider>
      <OfflineProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </OfflineProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}><ScreenState loading title="Checking your session" message="Verifying secure employee access…" /></View>;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!!session} redirectTo="/">
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="customers/index" />
        <Stack.Screen name="customers/[id]" />
        <Stack.Screen name="meters/scan" />
        <Stack.Screen name="meters/replace/[customerId]" />
        <Stack.Screen name="reading/[id]" />
        <Stack.Screen name="reading/confirm/[id]" />
        <Stack.Screen name="invoice/[id]" />
        <Stack.Screen name="printer" />
      </Stack.Protected>
      <Stack.Protected guard={!session} redirectTo="/dashboard">
        <Stack.Screen name="index" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
