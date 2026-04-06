import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    try {
        const userId = req.nextUrl.searchParams.get("userId");
        if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

        // Fetch trainer profile (select * to avoid missing column errors)
        const { data: profileRows } = await adminSupabase
            .from("trainer_profiles")
            .select("*")
            .eq("user_id", userId);
        const profile = profileRows && profileRows.length > 0 ? profileRows[0] : null;

        // Fetch user info
        const { data: user } = await adminSupabase
            .from("users")
            .select("id, first_name, last_name, email, created_at, phone")
            .eq("id", userId)
            .single();

        // Fetch bookings for this trainer
        const { data: bookings } = await adminSupabase
            .from("bookings")
            .select("id, status, scheduled_at, price, created_at, athlete_id")
            .eq("trainer_id", userId)
            .order("created_at", { ascending: false });

        const totalBookings = (bookings || []).length;
        const completedBookings = (bookings || []).filter((b: any) => b.status === "completed").length;
        const pendingBookings = (bookings || []).filter((b: any) => b.status === "pending").length;
        const cancelledBookings = (bookings || []).filter((b: any) => b.status === "cancelled").length;
        const upcomingBookings = (bookings || []).filter((b: any) => b.status === "confirmed").length;

        // Fetch payment transactions for this trainer
        const { data: payments } = await adminSupabase
            .from("payment_transactions")
            .select("id, amount, platform_fee, trainer_payout, status, created_at, booking_id")
            .in("booking_id", (bookings || []).map((b: any) => b.id))
            .order("created_at", { ascending: false });

        const totalRevenue = (payments || []).reduce((s: number, p: any) => s + Number(p.trainer_payout || 0), 0);
        const totalPlatformFee = (payments || []).reduce((s: number, p: any) => s + Number(p.platform_fee || 0), 0);
        const totalVolume = (payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        const releasedPayments = (payments || []).filter((p: any) => p.status === "released");
        const heldPayments = (payments || []).filter((p: any) => p.status === "held");
        const lastPaymentDate = payments && payments.length > 0 ? payments[0].created_at : null;

        return NextResponse.json({
            profile,
            user,
            stats: {
                totalBookings,
                completedBookings,
                pendingBookings,
                cancelledBookings,
                upcomingBookings,
                totalRevenue,
                totalPlatformFee,
                totalVolume,
                releasedCount: releasedPayments.length,
                heldCount: heldPayments.length,
                lastPaymentDate,
                paymentCount: (payments || []).length,
            },
            recentPayments: (payments || []).slice(0, 5).map((p: any) => ({
                id: p.id,
                amount: Number(p.amount || 0),
                trainerPayout: Number(p.trainer_payout || 0),
                platformFee: Number(p.platform_fee || 0),
                status: p.status,
                date: p.created_at,
            })),
        });
    } catch (err: any) {
        console.error("[admin/trainer-detail]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
