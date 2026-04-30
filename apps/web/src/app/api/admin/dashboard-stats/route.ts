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
        const { count: athletesCount } = await adminSupabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("role", "athlete");
        const { count: trainersCount } = await adminSupabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("role", "trainer");
        const { data: revData } = await adminSupabase
            .from("bookings")
            .select("price")
            .eq("status", "completed");
        const revenue = (revData || []).reduce((sum: number, b: any) => sum + Number(b.price || 0), 0);
        const { count: activeCount } = await adminSupabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("status", "confirmed");

        const stats = {
            athletes: athletesCount || 0,
            trainers: trainersCount || 0,
            revenue,
            activeBookings: activeCount || 0,
        };

        const { data: recentBookings } = await adminSupabase
            .from("bookings")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(5);

        let transactions: any[] = [];
        let activities: any[] = [];

        if (recentBookings && recentBookings.length > 0) {
            const userIds = new Set<string>();
            recentBookings.forEach((b: any) => {
                userIds.add(b.athlete_id);
                userIds.add(b.trainer_id);
            });
            const { data: usersData } = await adminSupabase
                .from("users")
                .select("id, first_name, last_name")
                .in("id", Array.from(userIds));
            const usersMap = new Map((usersData || []).map((u: any) => [u.id, `${u.first_name} ${u.last_name}`]));

            transactions = recentBookings.map((b: any) => ({
                id: `#TR-${b.id.substring(0, 5).toUpperCase()}`,
                athlete: usersMap.get(b.athlete_id) || "Unknown",
                trainer: usersMap.get(b.trainer_id) || "Unknown",
                date: new Date(b.created_at).toLocaleDateString(),
                amount: `$${Number(b.price || 0).toFixed(2)}`,
                status: b.status === "completed" ? "Completed" : "Pending",
            }));

            activities = recentBookings.map((b: any) => ({
                title: `Booking ${b.status}`,
                desc: `Session booked by ${usersMap.get(b.athlete_id) || "User"}`,
                time: new Date(b.created_at).toLocaleDateString(),
                dot: b.status === "completed" ? "bg-primary" : "bg-blue-500",
            }));
        }

        const { data: monthlyData } = await adminSupabase
            .from("bookings")
            .select("created_at")
            .gte("created_at", new Date(new Date().getFullYear(), 0, 1).toISOString());

        const monthlyCounts = Array(12).fill(0);
        (monthlyData || []).forEach((b: any) => {
            const month = new Date(b.created_at).getMonth();
            monthlyCounts[month]++;
        });

        const maxCount = Math.max(...monthlyCounts, 1);
        const hasBookings = monthlyCounts.some((c: number) => c > 0);
        const chartHeights = monthlyCounts.map((c: number) =>
            hasBookings ? Math.max(c > 0 ? 8 : 20, Math.round((c / maxCount) * 100)) : 20
        );

        return NextResponse.json({ stats, transactions, activities, chartHeights });
    } catch (err: any) {
        console.error("[admin/dashboard-stats]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
