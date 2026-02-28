"use client";

import { supabase, UserRow, TrainerProfileRow, AthleteProfileRow } from './supabase';

export interface AuthUser {
    id: string;
    email: string;
    role: 'athlete' | 'trainer' | 'admin';
    firstName: string;
    lastName: string;
    isApproved: boolean;
    avatarUrl: string | null;
    trainerProfile?: TrainerProfileRow | null;
    athleteProfile?: AthleteProfileRow | null;
}

// Simple session management using localStorage
const TOKEN_KEY = 'airtrainr_session';

export function setSession(user: AuthUser) {
    if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, JSON.stringify(user));
    }
}

export function getSession(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

export async function clearSession() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
    }
    await supabase.auth.signOut();
}

// Login: check email+password using real Supabase Auth
export async function loginUser(email: string, password: string): Promise<AuthUser> {
    const cleanEmail = email.toLowerCase().trim();

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
    });

    if (authError || !authData.user) {
        throw new Error(authError?.message || 'Invalid email or password');
    }

    // 2. Fetch public user profile
    let { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    // Fallback if the trigger didn't fire, try matching by email
    if (error || !user) {
        const { data: fallbackUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', cleanEmail)
            .single();

        if (fallbackUser) {
            user = fallbackUser;
        } else {
            throw new Error('User profile not found in database');
        }
    }

    const u = user as UserRow;

    // Fetch profile (Trainer or Athlete)
    let trainerProfile: TrainerProfileRow | null = null;
    let athleteProfile: AthleteProfileRow | null = null;

    if (u.role === 'trainer') {
        const { data } = await supabase
            .from('trainer_profiles')
            .select('*')
            .eq('user_id', u.id)
            .single();
        trainerProfile = data as TrainerProfileRow | null;
    } else if (u.role === 'athlete') {
        const { data } = await supabase
            .from('athlete_profiles')
            .select('*')
            .eq('user_id', u.id)
            .single();
        athleteProfile = data as AthleteProfileRow | null;
    }

    // Update last login
    await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', u.id);

    const authUser: AuthUser = {
        id: u.id,
        email: u.email,
        role: u.role,
        firstName: u.first_name,
        lastName: u.last_name,
        isApproved: u.is_approved || false,
        avatarUrl: u.avatar_url,
        trainerProfile,
        athleteProfile,
    };

    setSession(authUser);
    return authUser;
}

// Register a new user using real Supabase Auth
export async function registerUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'athlete' | 'trainer';
    dateOfBirth: string;
    sports?: string[];
    // Athlete-specific preferences
    skillLevel?: string;
    preferredTimes?: string[];
    trainingTypes?: string[];
    budgetMax?: number;
    city?: string;
    state?: string;
    travelRadius?: number;
}): Promise<AuthUser> {
    const cleanEmail = data.email.toLowerCase().trim();

    // Age check (must be 18+)
    const dob = new Date(data.dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (age < 18 || (age === 18 && monthDiff < 0)) {
        throw new Error('You must be at least 18 years old to register');
    }

    // 1. Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
    });

    if (authError || !authData?.user) {
        throw new Error(authError?.message || 'Failed to create account. Email might already exist.');
    }

    const authUserId = authData.user.id;

    // 2. Insert into public.users table (links to auth.users.id)
    const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
            id: authUserId,
            email: cleanEmail,
            password_hash: "auth_handled_by_supabase",
            role: data.role,
            first_name: data.firstName,
            last_name: data.lastName,
            date_of_birth: data.dateOfBirth,
            email_verified: false,
            is_approved: false,
        })
        .select()
        .single();

    if (userError || !newUser) {
        // Log the error but don't strictly fail if it might have been created by a trigger
        console.error("Manual insert to users table failed:", userError);
    }

    // Proceed assuming it's inserted by trigger or manually
    const { data: confirmedUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .single();

    if (!confirmedUser) {
        throw new Error('Failed to synchronize user profile.');
    }

    const u = confirmedUser as UserRow;

    // 3. Create role-specific profile
    let trainerProfile: TrainerProfileRow | null = null;
    let athleteProfile: AthleteProfileRow | null = null;

    if (data.role === 'trainer') {
        const { data: tp } = await supabase
            .from('trainer_profiles')
            .insert({
                user_id: u.id,
                sports: data.sports || [],
                trial_started_at: new Date().toISOString(),
                verification_status: 'pending',
                is_verified: false,
            })
            .select()
            .single();
        trainerProfile = tp as TrainerProfileRow | null;
    } else {
        const { data: ap } = await supabase
            .from('athlete_profiles')
            .insert({
                user_id: u.id,
                sports: data.sports || [],
                skill_level: data.skillLevel || 'beginner',
                preferred_training_times: data.preferredTimes || [],
                training_preferences: data.trainingTypes || [],
                city: data.city || null,
                state: data.state || null,
                travel_radius_miles: data.travelRadius || 25,
            })
            .select()
            .single();
        athleteProfile = ap as AthleteProfileRow | null;
    }

    const authUser: AuthUser = {
        id: u.id,
        email: u.email,
        role: u.role,
        firstName: u.first_name,
        lastName: u.last_name,
        isApproved: u.is_approved || false,
        avatarUrl: u.avatar_url,
        trainerProfile,
        athleteProfile,
    };

    setSession(authUser);
    return authUser;
}
