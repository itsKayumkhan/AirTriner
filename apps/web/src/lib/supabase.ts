import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper types for database tables
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
    is_approved: boolean;
    is_suspended: boolean;
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
    is_founding_50: boolean;
    founding_50_granted_at: string | null;
    is_sponsored: boolean;
    profile_views: number;
    completion_rate: number;
    reliability_score: number;
    total_sessions: number;
    average_rating: number | null;
    total_reviews: number;
    city: string | null;
    state: string | null;
    country: string | null;
    address_line1: string | null;
    zip_code: string | null;
    latitude: number | null;
    longitude: number | null;
    travel_radius_miles: number;
    training_types: string[] | null;
    preferred_training_times: ('morning'|'afternoon'|'evening')[] | null;
    target_skill_levels: ('beginner'|'intermediate'|'advanced'|'pro')[] | null;
    created_at: string;
};

export type AthleteProfileRow = {
    id: string;
    user_id: string;
    skill_level: 'beginner' | 'intermediate' | 'advanced' | 'pro';
    sports: string[];
    city: string | null;
    state: string | null;
    country: string | null;
    address_line1: string | null;
    zip_code: string | null;
    latitude: number | null;
    longitude: number | null;
    travel_radius_miles: number;
    preferred_training_times: ('morning'|'afternoon'|'evening')[] | null;
    created_at: string;
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
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'disputed' | 'reschedule_requested' | 'rejected';
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

export type PaymentTransactionRow = {
    id: string;
    booking_id: string;
    athlete_id: string;
    trainer_id: string;
    amount: number;
    platform_fee: number;
    trainer_payout: number;
    stripe_payment_intent_id: string | null;
    stripe_transfer_id: string | null;
    status: 'pending' | 'completed' | 'refunded' | 'failed';
    created_at: string;
};

export type TrainingOfferRow = {
    id: string;
    trainer_id: string;
    athlete_id: string;
    sport: string | null;
    message: string | null;
    price: number;
    session_length_min: number;
    proposed_dates: unknown;
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    created_at: string;
    expires_at: string | null;
};

export type AvailabilitySlotRow = {
    id: string;
    trainer_id: string;
    day_of_week: number | null;
    start_time: string;
    end_time: string;
    is_recurring: boolean;
    specific_date: string | null;
    created_at: string;
};

export type SubAccountRow = {
    id: string;
    parent_athlete_id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string | null;
    sport: string | null;
    skill_level: string | null;
    created_at: string;
};

export type DisputeRow = {
    id: string;
    booking_id: string;
    raised_by: string;
    reason: string | null;
    description: string | null;
    status: 'open' | 'under_review' | 'resolved' | 'closed';
    resolution: string | null;
    resolved_at: string | null;
    created_at: string;
};

export type PlatformSettingsRow = {
    id: string;
    platform_fee_percentage: number;
    require_trainer_verification: boolean;
    allow_athlete_registration: boolean;
    allow_trainer_registration: boolean;
    maintenance_mode: boolean;
    updated_at: string;
};

export type SportRow = {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    is_active: boolean;
    image_url: string | null;
};

export type TrainerMediaRow = {
    id: string;
    trainer_id: string;
    url: string;
    type: 'image' | 'video';
    caption: string | null;
    sort_order: number;
    created_at: string;
};
