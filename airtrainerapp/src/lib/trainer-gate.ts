// Trainer public-visibility gate — mirror of apps/web/src/lib/trainer-gate.ts.
// Keep in sync. The four conditions are: verified, subscription active, profile
// complete, user active.

import { computeTrainerCompleteness } from './profile-completeness';

export type GateInput = {
    user: {
        is_suspended?: boolean | null;
        deleted_at?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        phone?: string | null;
        date_of_birth?: string | null;
        avatar_url?: string | null;
    } | null | undefined;
    trainerProfile: {
        verification_status?: string | null;
        subscription_status?: string | null;
        bio?: string | null;
        sports?: string[] | null;
        city?: string | null;
        years_experience?: number | null;
        session_pricing?: any;
        training_locations?: string[] | null;
    } | null | undefined;
};

export type GateResult =
    | { ok: true }
    | {
          ok: false;
          reason:
              | 'user_missing'
              | 'profile_missing'
              | 'user_suspended'
              | 'user_deleted'
              | 'not_verified'
              | 'no_subscription'
              | 'profile_incomplete';
          missing?: string[];
      };

const ACTIVE_SUB = new Set(['trial', 'active']);

export function trainerPublicGate(input: GateInput): GateResult {
    const { user, trainerProfile } = input;
    if (!user) return { ok: false, reason: 'user_missing' };
    if (!trainerProfile) return { ok: false, reason: 'profile_missing' };
    if (user.is_suspended) return { ok: false, reason: 'user_suspended' };
    if (user.deleted_at) return { ok: false, reason: 'user_deleted' };
    if (trainerProfile.verification_status !== 'verified') {
        return { ok: false, reason: 'not_verified' };
    }
    const sub = (trainerProfile.subscription_status || '').toLowerCase();
    if (!ACTIVE_SUB.has(sub)) {
        return { ok: false, reason: 'no_subscription' };
    }
    const completeness = computeTrainerCompleteness(user, trainerProfile);
    if (!completeness.complete) {
        return { ok: false, reason: 'profile_incomplete', missing: completeness.missing };
    }
    return { ok: true };
}

export function publicGateAthleteMessage(result: GateResult): string {
    if (result.ok) return '';
    return "This trainer isn't accepting bookings right now.";
}
