const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase configuration. Copy .env.example to .env and set the EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY values.',
  );
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl)) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL must be a valid Supabase project URL.');
}

if (!supabasePublishableKey.startsWith('sb_publishable_') && !supabasePublishableKey.startsWith('eyJ')) {
  throw new Error('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable or legacy anonymous client key.');
}

export const env = { supabaseUrl, supabasePublishableKey } as const;
