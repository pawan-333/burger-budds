import { getVerifiedUser } from "@/lib/supabase/server";
import { getRiderDb, isRiderUuid, RiderAccessError, riderError, riderJson } from "@/lib/rider-access";
import { parseRiderDetails } from "@/lib/order-rider";
import { riderLoginIdentity } from "@/lib/rider-login";

async function authorize(request: Request) {
  if (!/^Bearer [^\s]+$/i.test(request.headers.get("authorization") || "")) throw new RiderAccessError(401, "Administrator sign-in required.");
  const user = await getVerifiedUser(request);
  if (!user) throw new RiderAccessError(401, "Administrator sign-in required.");
  const db = getRiderDb();
  const role = await db.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (role.error) throw new RiderAccessError(503, "Could not verify administrator access.");
  if (!role.data) throw new RiderAccessError(403, "Only a super administrator can set rider PINs.");
  return db;
}

export async function GET(request: Request) {
  try {
    const db = await authorize(request);
    const { data, error } = await db.from("rider_accounts")
      .select("rider_id,is_active,rider:riders!inner(name,phone),outlet:outlets!inner(name)");
    if (error) throw new RiderAccessError(503, "Could not load saved riders.");
    return riderJson({ riders: data || [] });
  } catch (error) { return riderError(error); }
}

export async function POST(request: Request) {
  try {
    const db = await authorize(request);
    const body = await request.json();
    const pin = body.pin;
    if (!isRiderUuid(body.riderId) || typeof pin !== "string" || !/^\d{6}$/.test(pin) || /^(\d)\1{5}$/.test(pin) || ["123456", "654321"].includes(pin)) {
      return riderJson({ error: "Select a rider and enter a private 6-digit PIN; avoid repeated or sequential digits." }, 400);
    }
    const result = await db.from("rider_accounts").select("user_id,rider:riders!inner(name,phone)").eq("rider_id", body.riderId).maybeSingle();
    if (result.error) throw new RiderAccessError(503, "Could not load rider account.");
    const account = result.data as unknown as { user_id: string; rider: { name: string; phone: string } } | null;
    if (!account) return riderJson({ error: "Rider account not found." }, 404);
    const phone = parseRiderDetails(account.rider.name, account.rider.phone)?.phone;
    const auth = await db.auth.admin.getUserById(account.user_id);
    if (!phone || auth.error || !auth.data.user || `+${auth.data.user.phone?.replace(/^\+/, "")}` !== phone || auth.data.user.email !== riderLoginIdentity(phone)?.email) {
      throw new RiderAccessError(409, "Rider phone and login account do not match. Contact the administrator.");
    }
    const updated = await db.auth.admin.updateUserById(account.user_id, { password: pin });
    if (updated.error) throw new RiderAccessError(400, "PIN could not be saved. Use a different 6-digit PIN.");
    const activated = await db.from("rider_accounts").update({ is_active: true }).eq("rider_id", body.riderId);
    if (activated.error) throw new RiderAccessError(503, "PIN saved, but account activation failed. Retry this setup.");
    return riderJson({ ok: true });
  } catch (error) { return riderError(error); }
}
