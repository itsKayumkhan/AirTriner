import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
// import { sendProfileNotification } from "@/lib/email";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * POST /api/cron/profile-notify
 * Sends a notification email when a new athlete still needs to complete their profile.
*/
export async function GET() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
    
    const { data: users, error } = await admin
      .from("users")
      .select("id, email, first_name, last_name, role, created_at")
      .gte("created_at", eightDaysAgo.toISOString())
      .lt("created_at", sevenDaysAgo.toISOString())
      .eq("first_name", "Amir");

    if (error) {
      throw error;
    }

    users.forEach(u => {
      console.log(u.email);
    });

    return NextResponse.json({
      ok: true,
      usersFound: users.length,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}