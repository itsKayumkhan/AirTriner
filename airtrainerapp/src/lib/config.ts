// Centralized config — reads from EXPO_PUBLIC_ env vars (Expo SDK 49+)
// Fallback to app.json extra for EAS builds

import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const Config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '',
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || extra.stripePublishableKey || '',
  appUrl: process.env.EXPO_PUBLIC_APP_URL || extra.appUrl || 'http://localhost:3000',
};

// Validate required config at startup
if (!Config.supabaseUrl || !Config.supabaseAnonKey) {
  console.error(
    'Missing Supabase configuration. Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env'
  );
}
