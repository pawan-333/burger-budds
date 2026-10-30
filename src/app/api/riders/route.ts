import { getVerifiedUser } from "@/lib/supabase/server";
import { getAssignableRiders, isRiderUuid, riderError, riderJson } from "@/lib/rider-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return riderJson({ error: "Store sign-in required." }, 401);
    const orderId = new URL(request.url).searchParams.get("orderId");
    if (!isRiderUuid(orderId)) return riderJson({ error: "Invalid order." }, 400);
    return riderJson({ riders: await getAssignableRiders(user.id, orderId) });
  } catch (error) { return riderError(error); }
}
