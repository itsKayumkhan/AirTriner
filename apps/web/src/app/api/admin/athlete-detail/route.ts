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
        const userId = req.nextUrl.searchParams.get("userId");
        if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

        // Fetch user info
        const { data: user } = await adminSupabase
            .from("users")
            .select("id, first_name, last_name, email, created_at, phone, is_suspended, role")
            .eq("id", userId)
            .single();

        // Fetch athlete profile
        const { data: profile } = await adminSupabase
            .from("athlete_profiles")
            .select("*")
            .eq("user_id", userId)
            .single();

        // Fetch bookings
        const { data: bookings } = await adminSupabase
            .from("bookings")
            .select("id, status, scheduled_at, price, created_at, trainer_id, sport")
            .eq("athlete_id", userId)
            .order("created_at", { ascending: false });

        const totalBookings = (bookings || []).length;
        const completedBookings = (bookings || []).filter((b: any) => b.status === "completed").length;
        const pendingBookings = (bookings || []).filter((b: any) => b.status === "pending").length;
        const cancelledBookings = (bookings || []).filter((b: any) => b.status === "cancelled").length;
        const upcomingBookings = (bookings || []).filter((b: any) => b.status === "confirmed").length;

        // Fetch payment transactions
        const bookingIds = (bookings || []).map((b: any) => b.id);
        let payments: any[] = [];
        if (bookingIds.length > 0) {
            const { data: payData } = await adminSupabase
                .from("payment_transactions")
                .select("id, amount, platform_fee, trainer_payout, status, created_at, booking_id")
                .in("booking_id", bookingIds)
                .order("created_at", { ascending: false });
            payments = payData || [];
        }

        const totalSpent = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        const lastPaymentDate = payments.length > 0 ? payments[0].created_at : null;

        // Fetch sub-accounts
        const { data: subAccounts } = await adminSupabase
            .from("sub_accounts")
            .select("id, profile_data, is_active, created_at")
            .eq("parent_user_id", userId);

        return NextResponse.json({
            user,
            profile,
            stats: {
                totalBookings,
                completedBookings,
                pendingBookings,
                cancelledBookings,
                upcomingBookings,
                totalSpent,
                lastPaymentDate,
                paymentCount: payments.length,
                subAccountCount: (subAccounts || []).length,
            },
            recentBookings: (bookings || []).slice(0, 5).map((b: any) => ({
                id: b.id,
                sport: b.sport,
                status: b.status,
                scheduledAt: b.scheduled_at,
                price: Number(b.price || 0),
                date: b.created_at,
            })),
        });
    } catch (err: any) {
        console.error("[admin/athlete-detail]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
