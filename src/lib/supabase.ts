import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { env } from './env';
import type { Database } from '../types/database.types';
import { runtimeStorage } from '../services/runtimeStorage';

declare const module: { hot?: { dispose(callback: () => void): void } };

const memoryState = globalThis as typeof globalThis & {
  __nmmpcSupabaseRuntime?: {
    client: SupabaseClient<Database>;
    appStateSubscription?: { remove(): void };
  };
};

// Clean up the globally cached client used by earlier development builds.
// Its refresh interval can otherwise survive this module replacement and keep
// calling an AsyncStorage native object that Expo Go has already closed.
if (memoryState.__nmmpcSupabaseRuntime) {
  memoryState.__nmmpcSupabaseRuntime.appStateSubscription?.remove();
  void memoryState.__nmmpcSupabaseRuntime.client.auth.dispose();
  delete memoryState.__nmmpcSupabaseRuntime;
}
export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabasePublishableKey,
  {
    auth: {
      // Expo Go can close its native AsyncStorage resource during a development
      // reload while an auth tick is active. Keep its test session in JS memory;
      // development and production builds retain persistent AsyncStorage.
      ...(Platform.OS !== 'web' ? { storage: runtimeStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Supabase recommends refreshing native sessions only while the app is active.
const appStateSubscription = Platform.OS !== 'web'
  ? AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  })
  : undefined;

// Metro invokes this before replacing the module during Fast Refresh.
module.hot?.dispose(() => {
  appStateSubscription?.remove();
  void supabase.auth.dispose();
});
