import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, getVerifiedUser } from "@/lib/supabase/server";
import { PUBLIC_MERCHANT_ACCESS } from "@/lib/site-access";
import {
  getMenuBundle,
  getSupabaseAdminClient,
  readLocalStore,
  writeLocalStore,
} from "@/lib/server-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const outletSlug = req.nextUrl.searchParams.get("outlet") || undefined;
  const bundle = await getMenuBundle(outletSlug);
  return NextResponse.json(bundle);
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const session = PUBLIC_MERCHANT_ACCESS ? getSupabaseAdminClient() : await getSupabaseServerClient();
    if (session) {
      const user = await getVerifiedUser();
      if (!user && !PUBLIC_MERCHANT_ACCESS) return NextResponse.json({ error: "Please log in." }, { status: 401 });
      const { data: memberships } = PUBLIC_MERCHANT_ACCESS
        ? { data: [{ outlet_id: (await getMenuBundle()).outlet.id }] }
        : await session.from("staff").select("outlet_id").eq("user_id", user!.id);
      if (!memberships?.length) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
      const outletIds = memberships.map((membership) => membership.outlet_id);
      if (body.action === "update_item" && body.itemId) {
        const patch: Record<string, unknown> = {};
        if (typeof body.is_available === "boolean") patch.is_available = body.is_available;
        if (typeof body.price === "number" && Number.isFinite(body.price) && body.price > 0) patch.price = body.price;
        if (!Object.keys(patch).length) return NextResponse.json({ error: "Invalid item update." }, { status: 400 });
        const { data, error } = await session.from("items").update(patch).eq("id", body.itemId).in("outlet_id", outletIds).select().maybeSingle();
        if (error || !data) return NextResponse.json({ error: "Item update failed." }, { status: 400 });
        return NextResponse.json({ ok: true, item: data });
      }
      if (body.action === "toggle_category_stock" && body.categoryId) {
        if (typeof body.is_available !== "boolean") return NextResponse.json({ error: "Invalid stock value." }, { status: 400 });
        const { data, error } = await session.from("items").update({ is_available: body.is_available }).eq("category_id", body.categoryId).in("outlet_id", outletIds).select("id");
        if (error || !data?.length) return NextResponse.json({ error: "Category update failed." }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      if (body.action === "update_outlet") {
        const { outlet } = await getMenuBundle();
        const patch: Record<string, unknown> = {};
        if (typeof body.is_open === "boolean") patch.is_open = body.is_open;
        if (Number.isInteger(body.prep_time_min) && body.prep_time_min > 0 && body.prep_time_min <= 120) patch.prep_time_min = body.prep_time_min;
        if (typeof body.delivery_enabled === "boolean") patch.delivery_enabled = body.delivery_enabled;
        if (Number.isInteger(body.pause_minutes) && body.pause_minutes >= 0 && body.pause_minutes <= 1440) {
          patch.pause_until = body.pause_minutes ? new Date(Date.now() + body.pause_minutes * 60_000).toISOString() : null;
          patch.is_open = body.pause_minutes === 0;
        }
        const { data, error } = await session.from("outlets").update(patch).eq("id", outlet.id).in("id", outletIds).select().maybeSingle();
        if (error || !data) return NextResponse.json({ error: "Store update failed." }, { status: 400 });
        return NextResponse.json({ ok: true, outlet: data });
      }
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Store service is not configured." }, { status: 503 });
    const store = readLocalStore();
    const sb = getSupabaseAdminClient();

    // 1. Toggle item stock or update price
    if (body.action === "update_item" && body.itemId) {
      const idx = store.items.findIndex((i) => i.id === body.itemId);
      if (idx !== -1) {
        if (typeof body.is_available === "boolean") {
          store.items[idx].is_available = body.is_available;
        }
        if (typeof body.price === "number" && body.price > 0) {
          store.items[idx].price = body.price;
        }
        writeLocalStore(store);
      }

      if (sb) {
        const updatePayload: Record<string, unknown> = {};
        if (typeof body.is_available === "boolean")
          updatePayload.is_available = body.is_available;
        if (typeof body.price === "number" && body.price > 0)
          updatePayload.price = body.price;
        await sb.from("items").update(updatePayload).eq("id", body.itemId);
      }

      return NextResponse.json({
        ok: true,
        item: idx !== -1 ? store.items[idx] : null,
      });
    }

    // 2. Category-level stock toggle
    if (body.action === "toggle_category_stock" && body.categoryId) {
      const available = Boolean(body.is_available);
      store.items = store.items.map((item) =>
        item.category_id === body.categoryId
          ? { ...item, is_available: available }
          : item
      );
      writeLocalStore(store);

      if (sb) {
        await sb
          .from("items")
          .update({ is_available: available })
          .eq("category_id", body.categoryId);
      }

      return NextResponse.json({ ok: true });
    }

    // 3. Outlet controls (Open/Close, prep time, pause, delivery toggle)
    if (body.action === "update_outlet") {
      if (typeof body.is_open === "boolean") {
        store.outlet.is_open = body.is_open;
      }
      if (typeof body.prep_time_min === "number") {
        store.outlet.prep_time_min = body.prep_time_min;
      }
      if (typeof body.delivery_enabled === "boolean") {
        store.outlet.delivery_enabled = body.delivery_enabled;
      }
      if (body.pause_minutes !== undefined) {
        if (body.pause_minutes > 0) {
          store.outlet.pause_until = new Date(
            Date.now() + body.pause_minutes * 60 * 1000
          ).toISOString();
          store.outlet.is_open = false;
        } else {
          store.outlet.pause_until = null;
          store.outlet.is_open = true;
        }
      }
      writeLocalStore(store);

      if (sb) {
        await sb
          .from("outlets")
          .update({
            is_open: store.outlet.is_open,
            prep_time_min: store.outlet.prep_time_min,
          })
          .eq("id", store.outlet.id);
      }

      return NextResponse.json({ ok: true, outlet: store.outlet });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Menu PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update menu/outlet" },
      { status: 500 }
    );
  }
}
