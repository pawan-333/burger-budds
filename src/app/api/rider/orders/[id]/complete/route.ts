import { getVerifiedUser } from "@/lib/supabase/server";
import { getRiderDb, isRiderUuid, riderError, riderJson, riderRpcError } from "@/lib/rider-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Explicit bearer authentication prevents ambient-cookie cross-site mutations.
    if (!/^Bearer [^\s]+$/i.test(request.headers.get("authorization") || "")) return riderJson({ error: "Sign in again to update a delivery." }, 401);
    const user = await getVerifiedUser(request);
    if (!user) return riderJson({ error: "Sign in again to update a delivery." }, 401);
    const { id } = await params;
    if (!isRiderUuid(id)) return riderJson({ error: "Invalid order." }, 400);
    const { data, error } = await getRiderDb().rpc("complete_rider_delivery", { target_order_id: id, acting_user: user.id });
    if (error) return riderRpcError(error);
    return riderJson({ order: data });
  } catch (error) { return riderError(error); }
}
