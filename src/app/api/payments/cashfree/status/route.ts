import { NextRequest, NextResponse } from "next/server";
import { ownedCashfreeOrder, reconcileCashfreeOrder } from "@/lib/cashfree-orders";

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const order = typeof body.orderId === "string" ? await ownedCashfreeOrder(body.orderId) : null;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    return NextResponse.json(await reconcileCashfreeOrder(order.id), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Payment verification unavailable. Please retry; do not pay again until status is checked." }, { status: 502 });
  }
}
