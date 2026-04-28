// ============================================
// Trainer public-visibility gate — single source of truth.
//
// A trainer is publicly visible (search, direct profile, bookable) ONLY when
// ALL FOUR of these are true:
//
//   1. verification_status === 'verified'   (admin manually approved)
//   2. subscription_status IN ('trial','active')  (paying or in 7-day trial)
//   3. profile completeness                  (mandatory fields filled)
//   4. user is active                         (NOT suspended, NOT soft-deleted)
//
// Any caller that lets athletes view a trainer, message a trainer (outside an
// existing in-flight booking), or pay for a session against a trainer MUST run
// this gate. Centralized so the policy never drifts between web search, web
// direct-URL, the booking API, and mobile.
// ============================================

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
          missing?: string[]; // populated when reason === 'profile_incomplete'
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

/**
 * Athlete-facing message for why a trainer page can't be shown / booked.
 * Generic on purpose — we don't tell athletes "the trainer didn't pay" or
 * "their bio is too short". Just: not available right now.
 */
export function publicGateAthleteMessage(result: GateResult): string {
    if (result.ok) return '';
    return "This trainer isn't accepting bookings right now.";
}
