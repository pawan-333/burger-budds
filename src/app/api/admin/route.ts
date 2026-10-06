import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/server-db";

export const dynamic = "force-dynamic";
async function adminClient() {
  const user = await getVerifiedUser();
  if (!user) return null;
  const client = getSupabaseAdminClient();
  if (!client) return null;
  const { data } = await client.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return data ? client : null;
}
export async function GET() {
  const client = await adminClient();
  if (!client) return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  const [stores, staff] = await Promise.all([
    client.from("outlets").select("*").order("name"),
    client.from("staff").select("id, user_id, outlet_id, role"),
  ]);
  if (stores.error || staff.error) return NextResponse.json({ error: "Unable to load accounts." }, { status: 500 });
  const merchants = [];
  for (const member of staff.data || []) {
    const { data } = await client.auth.admin.getUserById(member.user_id);
    merchants.push({ ...member, email: data.user?.email || "Unknown account" });
  }
  return NextResponse.json({ stores: stores.data, merchants });
}
export async function POST(req: NextRequest) {
  const client = await adminClient();
  if (!client) return NextResponse.json({ error: "Super admin access required." }, { status: 403 });
  try {
    const body = await req.json();
    if (body.action === "add_store") {
      const fields = ["name", "slug", "address", "area", "phone"] as const;
      if (fields.some(field => typeof body[field] !== "string" || !body[field].trim()) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) || !Number.isFinite(body.lat) || Math.abs(body.lat) > 90 || !Number.isFinite(body.lng) || Math.abs(body.lng) > 180) {
        return NextResponse.json({ error: "Provide valid store details and coordinates." }, { status: 400 });
      }
      const { error } = await client.from("outlets").insert({
        name: body.name.trim(), slug: body.slug, address: body.address.trim(), area: body.area.trim(), phone: body.phone.trim(),
        lat: body.lat, lng: body.lng, is_open: false, delivery_enabled: false,
      });
      if (error) throw error;
    } else if (body.action === "archive_store" || body.action === "restore_store") {
      const active = body.action === "restore_store";
      const { data, error } = await client.from("outlets").update(active ? { is_active: true } : { is_active: false, is_open: false, delivery_enabled: false }).eq("id", body.outletId).select("id").maybeSingle();
      if (error || !data) throw new Error("Store update failed.");
    } else if (body.action === "grant_access") {
      if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || !["manager", "staff"].includes(body.role)) return NextResponse.json({ error: "Valid merchant email and role required." }, { status: 400 });
      const { data: store } = await client.from("outlets").select("id").eq("id", body.outletId).eq("is_active", true).maybeSingle();
      if (!store) return NextResponse.json({ error: "Active store required." }, { status: 400 });
      const email = body.email.trim().toLowerCase();
      let account = null;
      for (let page = 1; ; page++) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
        if (error) throw error;
        account = data.users.find(user => user.email?.toLowerCase() === email) || null;
        if (account || data.users.length < 100) break;
      }
      if (!account) {
        if (typeof body.password !== "string" || body.password.length < 12) return NextResponse.json({ error: "For a new account, enter a password of at least 12 characters." }, { status: 400 });
        const { data, error } = await client.auth.admin.createUser({ email, password: body.password, email_confirm: true });
        if (error) throw error;
        account = data.user;
      }
      if (!account) throw new Error("Account creation failed.");
      const { error } = await client.from("staff").upsert({ user_id: account.id, outlet_id: store.id, role: body.role }, { onConflict: "user_id,outlet_id" });
      if (error) throw error;
    } else if (body.action === "revoke_access") {
      const { data, error } = await client.from("staff").delete().eq("id", body.membershipId).select("id").maybeSingle();
      if (error || !data) throw new Error("Access removal failed.");
    } else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Action failed. Check account/store details and try again." }, { status: 400 });
  }
}
