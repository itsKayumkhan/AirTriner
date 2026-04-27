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

    // 2. Resolve the source charge + the currency the transfer must use.
    //    When source_transaction is set, the transfer currency must match the
    //    BALANCE TRANSACTION currency, not the charge's presentment currency.
    //    A platform whose Stripe settlement currency is CAD will see USD charges
    //    settle to a CAD balance — Transfer must be CAD even though the charge
    //    was USD. We expand balance_transaction.currency to read this directly.
    let sourceTransaction: string | undefined;
    let sourceCurrency: string | undefined;
    if (stripePaymentIntentId) {
        try {
            const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId, {
                expand: ['latest_charge.balance_transaction'],
            });
            const latest = (pi.latest_charge ?? null) as string | Stripe.Charge | null;
            const readBalanceCurrency = (charge: Stripe.Charge | null): string | undefined => {
                if (!charge) return undefined;
                const bt = (charge.balance_transaction ?? null) as string | Stripe.BalanceTransaction | null;
                if (bt && typeof bt === 'object' && bt.currency) return bt.currency.toLowerCase();
                return undefined;
            };
            if (typeof latest === 'string') {
                sourceTransaction = latest;
                // No expanded charge available — fall back to PI currency.
                if (pi.currency) sourceCurrency = pi.currency.toLowerCase();
            } else if (latest && typeof latest === 'object') {
                sourceTransaction = latest.id;
                sourceCurrency =
                    readBalanceCurrency(latest)
                    || (latest.currency || pi.currency || '').toLowerCase()
                    || undefined;
            }
        } catch (err: any) {
            console.warn('[stripe-transfer] PI lookup failed', {
                txId, stripePaymentIntentId, code: err?.code, message: err?.message,
            });
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
