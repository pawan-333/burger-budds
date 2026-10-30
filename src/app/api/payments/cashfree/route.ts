import { NextRequest, NextResponse } from "next/server";
import { cashfreeConfig, cashfreeEnabled } from "@/lib/cashfree";
import { ownedCashfreeOrder, createCashfreeSession } from "@/lib/cashfree-orders";

export const dynamic = "force-dynamic";
export function GET() {
  const enabled = cashfreeEnabled();
  return NextResponse.json({ enabled, mode: enabled ? cashfreeConfig().mode : null }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  try {
    if (!cashfreeEnabled()) return NextResponse.json({ error: "Online payments are not configured yet." }, { status: 503 });
    const body = await req.json();
    const order = typeof body.orderId === "string" ? await ownedCashfreeOrder(body.orderId) : null;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    return NextResponse.json(await createCashfreeSession(order), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to start payment. Refresh payment status, then retry. If expired, cancel and place a new order." }, { status: 502 });
  }
}
