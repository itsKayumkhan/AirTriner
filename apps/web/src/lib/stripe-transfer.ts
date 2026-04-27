import Stripe from 'stripe';
import { stripeCurrency } from './currency';

export type TransferAttempt =
    | { ok: true; transferId: string }
    | { ok: false; reason: string; code?: string };

/**
 * Move trainer_payout from platform balance to a connected trainer account.
 *
 * Idempotency:
 * - Uses `release_<txId>` as the idempotency key. Re-calls with same txId
 *   replay the original Stripe response — never double-paid.
 *
 * Connect health:
 * - Verifies the destination account has payouts_enabled before transfer.
 *
 * Source linkage:
 * - When stripePaymentIntentId is supplied we resolve the latest_charge and
 *   pass it as source_transaction so the transfer is debited from that
 *   specific charge's funds (matters for reconciliation + reversals).
 */
export async function transferToTrainer(stripe: Stripe, params: {
    txId: string;
    bookingId: string;
    amountUsd: number;
    destinationAccountId: string;
    stripePaymentIntentId?: string | null;
}): Promise<TransferAttempt> {
    const { txId, bookingId, amountUsd, destinationAccountId, stripePaymentIntentId } = params;

    if (!destinationAccountId) {
        return { ok: false, reason: 'no_stripe_account' };
    }
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
        return { ok: false, reason: 'invalid_amount' };
    }

    // 1. Connect account health check
    try {
        const acct = await stripe.accounts.retrieve(destinationAccountId);
        if (!acct.payouts_enabled) {
            return { ok: false, reason: 'payouts_not_enabled' };
        }
    } catch (err: any) {
        return { ok: false, reason: 'account_lookup_failed', code: err?.code };
    }

    // 2. Resolve the source charge for proper transfer accounting + currency.
    //    When source_transaction is set, the transfer currency MUST match the
    //    source charge's currency (Stripe rejects USD transfer from a CAD charge).
    let sourceTransaction: string | undefined;
    let sourceCurrency: string | undefined;
    let piLookupFailed = false;
    if (stripePaymentIntentId) {
        try {
            const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId, {
                expand: ['latest_charge'],
            });
            const latest = (pi.latest_charge ?? null) as string | Stripe.Charge | null;
            if (typeof latest === 'string') {
                sourceTransaction = latest;
                if (pi.currency) sourceCurrency = pi.currency.toLowerCase();
            } else if (latest && typeof latest === 'object') {
                sourceTransaction = latest.id;
                sourceCurrency = (latest.currency || pi.currency || '').toLowerCase() || undefined;
            }
        } catch (err: any) {
            piLookupFailed = true;
            console.warn('[stripe-transfer] PI lookup failed', {
                txId, stripePaymentIntentId, code: err?.code, message: err?.message,
            });
            // If the saved PI no longer exists in Stripe, the platform can still
            // transfer from its general balance — but the audit trail is broken.
            // Surface this clearly instead of letting Stripe error opaquely.
            if (err?.code === 'resource_missing') {
                return {
                    ok: false,
                    reason: 'stripe_payment_intent_not_found',
                    code: err?.code,
                };
            }
        }
    }

    // sourceCurrency wins (must match charge), platform default fallback otherwise.
    const transferCurrency = stripeCurrency(sourceCurrency);
    console.log('[stripe-transfer] resolved', {
        txId, bookingId, sourceTransaction, sourceCurrency, transferCurrency,
    });

    // 3. Transfer
    try {
        const transfer = await stripe.transfers.create(
            {
                amount: Math.round(amountUsd * 100),
                currency: transferCurrency,
                destination: destinationAccountId,
                transfer_group: `booking_${bookingId}`,
                metadata: { booking_id: bookingId, tx_id: txId },
                ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
            },
            // v2 prefix: invalidates any v1 idempotency cache from the
            // pre-currency-fix code that hardcoded USD on CAD source charges.
            { idempotencyKey: `release_v2_${txId}` }
        );
        return { ok: true, transferId: transfer.id };
    } catch (err: any) {
        return { ok: false, reason: err?.message || 'transfer_failed', code: err?.code };
    }
}
