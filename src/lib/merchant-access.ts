import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffRole } from "@/types/database";
type AccessResult =
  | { status: "login" }
  | { status: "denied"; message: string }
  | { status: "admin" }
  | { status: "allowed"; slug: string; role: StaffRole };
export function merchantLoginError(error: { code?: string; status?: number; message?: string }): string {
  if (error.code === "invalid_credentials") return "Email or password is incorrect. The merchant account must be created by your administrator before you can sign in.";
  if (error.code === "email_not_confirmed") return "This account's email is not confirmed. Ask your administrator to complete account setup.";
  if (error.status === 429) return "Too many login attempts. Please wait a few minutes and try again.";
  if (error.code === "email_provider_disabled") return "Email/password login is disabled. Enable it in Supabase Authentication settings.";
  if (/fetch|network/i.test(error.message || "")) return "Cannot connect to the login service. Check your connection and try again.";
  return "Unable to sign in. Please try again or contact your administrator.";
}
export async function verifyMerchantAccess(client: SupabaseClient, requestedSlug: string | null): Promise<AccessResult> {
  try {
    const { data, error } = await client.auth.getUser();
    if (error && /fetch|network/i.test(error.message)) return { status: "denied", message: "Cannot connect to the login service. Please retry." };
    if (!data.user) return { status: "login" };
    const { data: admin, error: adminError } = await client.from("super_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
    const schemaMissing = adminError && ["42P01", "PGRST205"].includes(adminError.code);
    if (adminError && !schemaMissing) return { status: "denied", message: "Unable to verify admin access. Please retry." };
    if (admin && !requestedSlug) return { status: "admin" };
    const { data: staff, error: staffError } = await client.from("staff").select("role, outlet_id").eq("user_id", data.user.id).order("outlet_id").limit(1).maybeSingle();
    if (staffError) return { status: "denied", message: "Unable to verify store membership. Please retry." };
    if (!admin && !staff) return { status: "denied", message: schemaMissing ? "Login succeeded, but merchant setup is incomplete. Your administrator must apply migrations 006 and 007 and assign this account to a store." : "Login succeeded, but no store access is assigned. Ask the super admin to grant merchant access." };
    const query = () => {
      const lookup = client.from("outlets").select("slug, is_active");
      return admin ? lookup.eq("slug", requestedSlug!) : lookup.eq("id", staff!.outlet_id);
    };
    let { data: store, error: storeError } = await query().maybeSingle();
    if (storeError?.code === "42703" && storeError.message.includes("is_active")) {
      const lookup = client.from("outlets").select("slug");
      const legacy = await (admin ? lookup.eq("slug", requestedSlug!) : lookup.eq("id", staff!.outlet_id)).maybeSingle();
      store = legacy.data as typeof store; storeError = legacy.error;
    }
    if (storeError) return { status: "denied", message: "Unable to load your assigned store. Please retry." };
    if (!store || store.is_active === false) return { status: "denied", message: "Your assigned store is unavailable or archived. Contact the super admin." };
    return { status: "allowed", slug: store.slug, role: admin ? "owner" : staff!.role as StaffRole };
  } catch {
    return { status: "denied", message: "Cannot connect to verify store access. Please retry." };
  }
}
