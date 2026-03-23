import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = 'https://duaqkmptxsnonvtfdohp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1YXFrbXB0eHNub252dGZkb2hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjUwOTAsImV4cCI6MjA4NzE0MTA5MH0.5glBvL0FsyhWvtasjvmfOQwMOP8LFQf-Jq2e5ji92XE';

const NativeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: NativeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Type definitions matching database schema
export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  role: 'athlete' | 'trainer' | 'admin';
  first_name: string;
  last_name: string;
  phone: string | null;
  date_of_birth: string | null;
  sex: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  last_login_at: string | null;
};

export type TrainerProfileRow = {
  id: string;
  user_id: string;
  bio: string | null;
  headline: string | null;
  years_experience: number;
  hourly_rate: number;
  sports: string[];
  certifications: unknown;
  verification_status: 'pending' | 'verified' | 'rejected' | 'suspended';
  is_verified: boolean;
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled';
  subscription_expires_at: string | null;
  trial_started_at: string | null;
  stripe_account_id: string | null;
  completion_rate: number;
  reliability_score: number;
  total_sessions: number;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  travel_radius_miles: number;
  created_at: string;
  trainingTypes: string[] | null;
  preferredTrainingTimes: string[] | null;
};

export type AthleteProfileRow = {
  id: string;
  user_id: string;
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'pro';
  sports: string[];
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  travel_radius_miles: number;
  created_at: string;
  preferredTrainingTimes: string[] | null;
  trainingPreferences: string[] | null;
};

export type BookingRow = {
  id: string;
  athlete_id: string;
  trainer_id: string;
  sub_account_id: string | null;
  sport: string;
  skill_level_at_booking: string | null;
  scheduled_at: string;
  duration_minutes: number;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'disputed';
  athlete_notes: string | null;
  trainer_notes: string | null;
  price: number;
  platform_fee: number;
  total_paid: number;
  status_history: unknown;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export type ReviewRow = {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  review_text: string | null;
  categories: Record<string, number> | null;
  is_public: boolean;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
};

export type MessageRow = {
  id: string;
  booking_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};
