import { NextRequest, NextResponse } from "next/server";
import { validCashfreeSignature } from "@/lib/cashfree";
import { reconcileCashfreeOrder } from "@/lib/cashfree-orders";

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 131072) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    if (!validCashfreeSignature(raw, req.headers.get("x-webhook-timestamp"), req.headers.get("x-webhook-signature"))) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
    const event = JSON.parse(raw);
    const providerId = event?.data?.order?.order_id;
    if (typeof providerId !== "string" || !/^bb_[0-9a-f]{32}$/.test(providerId)) return NextResponse.json({ received: true });
    const id = providerId.slice(3).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
    // Re-fetch authoritative provider status; never fulfil based on the posted body.
    await reconcileCashfreeOrder(id);
    return NextResponse.json({ received: true });
  } catch {
    // Non-2xx causes provider retries when DB/provider reconciliation is unavailable.
    return NextResponse.json({ error: "Payment reconciliation unavailable." }, { status: 503 });
  }
}
