import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    try {
        const body = await req.json();
        const { trainerId, action, reason } = body as {
            trainerId: string;
            action: "approve" | "reject";
            reason?: string;
        };

        if (!trainerId) {
            return NextResponse.json({ error: "Missing trainerId" }, { status: 400 });
        }
        if (action !== "approve" && action !== "reject") {
            return NextResponse.json({ error: "Invalid action. Must be 'approve' or 'reject'" }, { status: 400 });
        }

        if (action === "approve") {
            const { error } = await adminSupabase
                .from("trainer_profiles")
                .update({
                    profile_image_status: "approved",
                    profile_image_rejection_reason: null,
                })
                .eq("user_id", trainerId);

            if (error) throw error;
        } else {
            const { error } = await adminSupabase
                .from("trainer_profiles")
                .update({
                    profile_image_status: "rejected",
                    profile_image_rejection_reason: reason || null,
                })
                .eq("user_id", trainerId);

            if (error) throw error;
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("[admin/approve-trainer-image]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
