import Stripe from 'stripe';

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

    // 2. Resolve the source charge for proper transfer accounting
    let sourceTransaction: string | undefined;
    if (stripePaymentIntentId) {
        try {
            const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
            const latest = (pi.latest_charge ?? null) as string | Stripe.Charge | null;
            if (typeof latest === 'string') sourceTransaction = latest;
            else if (latest && typeof latest === 'object') sourceTransaction = latest.id;
        } catch {
            // non-fatal — Transfer can still happen from platform balance
        }
    }

    // 3. Transfer
    try {
        const transfer = await stripe.transfers.create(
            {
                amount: Math.round(amountUsd * 100),
                currency: 'usd',
                destination: destinationAccountId,
                transfer_group: `booking_${bookingId}`,
                metadata: { booking_id: bookingId, tx_id: txId },
                ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
            },
            { idempotencyKey: `release_${txId}` }
        );
        return { ok: true, transferId: transfer.id };
    } catch (err: any) {
        return { ok: false, reason: err?.message || 'transfer_failed', code: err?.code };
    }
}
