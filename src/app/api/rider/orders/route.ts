import { getVerifiedUser } from "@/lib/supabase/server";
import { getRiderDashboard, riderError, riderJson } from "@/lib/rider-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return riderJson({ error: "Sign in to view your deliveries." }, 401);
    return riderJson(await getRiderDashboard(user.id));
  } catch (error) { return riderError(error); }
}
