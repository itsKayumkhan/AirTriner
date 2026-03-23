import { supabase, UserRow, TrainerProfileRow, AthleteProfileRow } from './supabase';

export interface AuthUser {
    id: string;
    email: string;
    role: 'athlete' | 'trainer' | 'admin';
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    trainerProfile?: TrainerProfileRow | null;
    athleteProfile?: AthleteProfileRow | null;
}

// Login with Supabase Auth
export async function loginUser(email: string, password: string): Promise<AuthUser> {
    const cleanEmail = email.toLowerCase().trim();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
    });

    if (authError || !authData.user) {
        throw new Error(authError?.message || 'Invalid email or password');
    }

    let { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    if (error || !user) {
        const { data: fallbackUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', cleanEmail)
            .single();

        if (fallbackUser) {
            user = fallbackUser;
        } else {
            throw new Error('User profile not found');
        }
    }

    const u = user as UserRow;

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

    await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', u.id);

    return {
        id: u.id,
        email: u.email,
        role: u.role,
        firstName: u.first_name,
        lastName: u.last_name,
        avatarUrl: u.avatar_url,
        trainerProfile,
        athleteProfile,
    };
}

// Register a new user
export async function registerUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'athlete' | 'trainer';
    dateOfBirth: string;
    sports?: string[];
    skillLevel?: string;
    preferredTimes?: string[];
    trainingTypes?: string[];
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

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
    });

    if (authError || !authData?.user) {
        throw new Error(authError?.message || 'Failed to create account');
    }

    const authUserId = authData.user.id;

    const { error: userError } = await supabase
        .from('users')
        .insert({
            id: authUserId,
            email: cleanEmail,
            password_hash: 'auth_handled_by_supabase',
            role: data.role,
            first_name: data.firstName,
            last_name: data.lastName,
            date_of_birth: data.dateOfBirth,
            email_verified: false,
        })
        .select()
        .single();

    if (userError) {
        console.error('Manual insert to users table failed:', userError);
    }

    const { data: confirmedUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .single();

    if (!confirmedUser) {
        throw new Error('Failed to synchronize user profile');
    }

    const u = confirmedUser as UserRow;

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
                city: data.city || null,
                state: data.state || null,
                travel_radius_miles: data.travelRadius || 25,
            })
            .select()
            .single();
        athleteProfile = ap as AthleteProfileRow | null;
    }

    return {
        id: u.id,
        email: u.email,
        role: u.role,
        firstName: u.first_name,
        lastName: u.last_name,
        avatarUrl: u.avatar_url,
        trainerProfile,
        athleteProfile,
    };
}

export async function logoutUser(): Promise<void> {
    await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (!user) return null;
    const u = user as UserRow;

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

    return {
        id: u.id,
        email: u.email,
        role: u.role,
        firstName: u.first_name,
        lastName: u.last_name,
        avatarUrl: u.avatar_url,
        trainerProfile,
        athleteProfile,
    };
}
