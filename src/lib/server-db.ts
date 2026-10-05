import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  Outlet,
  Category,
  MenuItem,
  Coupon,
  OrderRecord,
  OrderStatus,
  Address,
} from "@/types/database";
import {
  SEED_OUTLET,
  SEED_CATEGORIES,
  SEED_ITEMS,
  SEED_COUPONS,
  SEED_ORDERS,
} from "@/lib/seed-data";
import { isSupabaseConfigured } from "@/lib/supabase/client";

interface LocalStoreSchema {
  outlet: Outlet;
  categories: Category[];
  items: MenuItem[];
  coupons: Coupon[];
  orders: OrderRecord[];
  idempotencyKeys: Record<string, string>;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "burger-budds-db.json");

function getInitialStore(): LocalStoreSchema {
  return {
    outlet: structuredClone(SEED_OUTLET),
    categories: structuredClone(SEED_CATEGORIES),
    items: structuredClone(SEED_ITEMS),
    coupons: structuredClone(SEED_COUPONS),
    orders: structuredClone(SEED_ORDERS),
    idempotencyKeys: {},
  };
}

export function readLocalStore(): LocalStoreSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialStore();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw) as LocalStoreSchema;
    if (!parsed.outlet || !parsed.items || !parsed.categories) {
      const initial = getInitialStore();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    return parsed;
  } catch {
    return getInitialStore();
  }
}

export function writeLocalStore(store: LocalStoreSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write local store:", err);
  }
}

export function getSupabaseAdminClient() {
  if (!isSupabaseConfigured()) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// Haversine distance in kilometers
export function computeDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

// Ray-casting point in polygon check
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: Array<[number, number]>
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export async function getMenuBundle(outletSlug?: string) {
  const store = readLocalStore();
  const sb = getSupabaseAdminClient();
  if (sb) {
    try {
      const { data: outletData } = await sb
        .from("outlets")
        .select("*")
        .eq("slug", outletSlug || store.outlet.slug)
        .single();
      if (outletData) {
        const [{ data: categories }, { data: items }, { data: coupons }] =
          await Promise.all([
            sb
              .from("categories")
              .select("*")
              .eq("outlet_id", outletData.id)
              .order("sort_order"),
            sb
              .from("items")
              .select("*, variants:item_variants(*), addon_groups(*, addons(*))")
              .eq("outlet_id", outletData.id)
              .order("sort_order"),
            sb.from("coupons").select("*").eq("is_active", true),
          ]);
        if (categories && items) {
          return {
            outlet: outletData as Outlet,
            categories: categories as Category[],
            items: items as MenuItem[],
            coupons: (coupons || store.coupons) as Coupon[],
          };
        }
      }
    } catch {
      // Fallback to local store
    }
  }
  return {
    outlet: store.outlet,
    categories: store.categories.filter((c) => c.is_active),
    items: store.items,
    coupons: store.coupons.filter((c) => c.is_active),
  };
}

// Validate status transition rules per PLAN.md section 8
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed: ["accepted", "rejected", "cancelled"],
  accepted: ["preparing", "ready", "rejected", "cancelled"],
  preparing: ["ready"],
  ready: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
  delivered: [],
  rejected: [],
  cancelled: [],
};

export function canTransitionStatus(
  current: OrderStatus,
  next: OrderStatus
): boolean {
  if (current === next) return true;
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export type { LocalStoreSchema, Address };
