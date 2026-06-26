import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendProfileNotification } from "@/lib/email";

type TrainerProfile = {
  city: string;
  state: string;
  zip_code: string;
  country: string;
  bio: string;
};

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * POST /api/cron/profile-notify
 * Sends a notification email when a new athlete still needs to complete their profile.
*/
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    
    const { data: users, error } = await admin
      .from("users")
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        created_at,
        avatar_url,
        phone,
        trainer_profiles!inner (
          city,
          state,
          zip_code,
          country,
          bio
        )
      `)
      .gte("created_at", fourDaysAgo.toISOString())
      .lt("created_at", threeDaysAgo.toISOString());

    if (error) {
      throw error;
    }

    const usersMissingProfile = users.filter(user => {
      const profile = user.trainer_profiles as unknown as TrainerProfile;

      return (
        !user.email ||
        !user.avatar_url ||
        !user.phone ||
        !profile ||
        !profile.city ||
        !profile.state ||
        !profile.zip_code ||
        !profile.country ||
        !profile.bio
      );
    });

    for (const user of usersMissingProfile) {
      const profile = user.trainer_profiles as unknown as TrainerProfile;

      await sendProfileNotification({
        email: user.email,
        firstName: user.first_name ?? "",
        lastName: user.last_name ?? "",
        role: user.role,
        platform: "web",
        userId: user.id,
        avatar_url: user.avatar_url,
        phone: user.phone,
        city: profile?.city,
        state: profile?.state,
        zip_code: profile?.zip_code,
        country: profile?.country,
        bio: profile?.bio,
      });
    }


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