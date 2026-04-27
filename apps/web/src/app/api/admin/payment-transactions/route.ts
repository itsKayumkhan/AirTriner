import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    try {
        const { data: ptData, error } = await adminSupabase
            .from("payment_transactions")
            .select(`
                id, booking_id, stripe_payment_intent_id, stripe_transfer_id,
                amount, platform_fee, trainer_payout, status, hold_until, released_at, created_at,
                bookings (id, athlete_id, trainer_id, sport, scheduled_at, status)
            `)
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!ptData || ptData.length === 0) return NextResponse.json({ transactions: [], userMap: {} });

        // Fetch user names
        const userIds = new Set<string>();
        ptData.forEach((pt: any) => {
            if (pt.bookings?.athlete_id) userIds.add(pt.bookings.athlete_id);
            if (pt.bookings?.trainer_id) userIds.add(pt.bookings.trainer_id);
        });

        const { data: users } = await adminSupabase
            .from("users")
            .select("id, first_name, last_name")
            .in("id", Array.from(userIds));

        const userMap: Record<string, { name: string; initials: string }> = {};
        (users || []).forEach((u: any) => {
            userMap[u.id] = {
                name: `${u.first_name} ${u.last_name}`.trim(),
                initials: `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`.toUpperCase(),
            };
        });

        // Fetch trainer stripe accounts
        const trainerIds = [...new Set(ptData.map((pt: any) => pt.bookings?.trainer_id).filter(Boolean))];
        const { data: trainerProfiles } = await adminSupabase
            .from("trainer_profiles")
            .select("user_id, stripe_account_id")
            .in("user_id", trainerIds);

        const stripeMap: Record<string, string | null> = {};
        (trainerProfiles || []).forEach((tp: any) => { stripeMap[tp.user_id] = tp.stripe_account_id; });

        // Fetch active disputes
        const bookingIds = ptData.map((pt: any) => pt.booking_id);
        const { data: disputes } = await adminSupabase
            .from("disputes")
            .select("booking_id")
            .in("booking_id", bookingIds)
            .in("status", ["under_review", "escalated"]);

        const disputedSet = new Set((disputes || []).map((d: any) => d.booking_id));

        // Last month volume & commissions for % change
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

        const { data: lastMonthTx } = await adminSupabase
            .from("payment_transactions")
            .select("amount, platform_fee")
            .gte("created_at", lastMonthStart)
            .lte("created_at", lastMonthEnd);

        const { data: thisMonthTx } = await adminSupabase
            .from("payment_transactions")
            .select("amount, platform_fee")
            .gte("created_at", thisMonthStart);

        const calcTotals = (rows: any[]) => rows.reduce(
            (acc, r) => ({ vol: acc.vol + Number(r.amount || 0), comm: acc.comm + Number(r.platform_fee || 0) }),
            { vol: 0, comm: 0 }
        );

        const lastMonth = calcTotals(lastMonthTx || []);
        const thisMonth = calcTotals(thisMonthTx || []);

        const pctChange = (curr: number, prev: number): number | null => {
            if (curr === 0 && prev === 0) return null; // no data either month
            if (curr === 0) return null;               // no activity this month — hide badge
            if (prev === 0) return null;               // new platform, no baseline to compare
            return Math.round(((curr - prev) / prev) * 100);
        };

        const volPct  = pctChange(thisMonth.vol,  lastMonth.vol);
        const commPct = pctChange(thisMonth.comm, lastMonth.comm);

        // Last 6 months bar chart data
        const monthlyChart: { month: string; amount: number }[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
            const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
            const { data: mTx } = await adminSupabase
                .from("payment_transactions")
                .select("amount")
                .gte("created_at", start)
                .lte("created_at", end);
            const total = (mTx || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
            monthlyChart.push({
                month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
                amount: total,
            });
        }

        return NextResponse.json({ ptData, userMap, stripeMap, disputedBookingIds: Array.from(disputedSet), volPct, commPct, monthlyChart });
    } catch (err: any) {
        console.error("[admin/payment-transactions]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
