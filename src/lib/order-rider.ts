import type { OrderRecord } from "@/types/database";

export interface RiderDetails { name: string; phone: string; }
const HANDOVER_PREFIX = "rider-handover:";

export function parseRiderDetails(name: unknown, phone: unknown): RiderDetails | null {
  if (typeof name !== "string" || typeof phone !== "string") return null;
  const trimmedName = name.trim();
  const mobile = phone.trim().replace(/[\s()-]/g, "").replace(/^(?:\+91|91)(?=\d{10}$)/, "");
  if (!trimmedName || trimmedName.length > 80 || /[\u0000-\u001f\u007f]/.test(trimmedName) || !/^[6-9]\d{9}$/.test(mobile)) return null;
  return { name: trimmedName, phone: `+91${mobile}` };
}

export function riderHandoverNote(rider: RiderDetails): string {
  return HANDOVER_PREFIX + JSON.stringify(rider);
}

export function getOrderRider(order: Pick<OrderRecord, "events" | "rider_name" | "rider_phone">): RiderDetails | null {
  const events = (order.events || []).filter(event => event.status === "out_for_delivery" && event.actor === "merchant")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const event of events) {
    if (!event.note?.startsWith(HANDOVER_PREFIX)) continue;
    try {
      const rider = JSON.parse(event.note.slice(HANDOVER_PREFIX.length));
      const details = parseRiderDetails(rider?.name, rider?.phone);
      if (details) return details;
    } catch { /* Ignore older or malformed notes. */ }
  }
  return parseRiderDetails(order.rider_name, order.rider_phone);
}
