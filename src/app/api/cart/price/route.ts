import { NextRequest, NextResponse } from "next/server";
import { getMenuBundle } from "@/lib/server-db";
import { computeServerBill, ServerCartItemInput } from "@/lib/pricing";
import { OrderType } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cartItems: ServerCartItemInput[] = Array.isArray(body.items)
      ? body.items
      : [];
    const orderType: OrderType =
      body.orderType === "takeaway" ? "takeaway" : "delivery";
    const couponCode: string | null = body.couponCode || null;
    const useWallet = Boolean(body.useWallet);
    const walletBalance =
      typeof body.walletBalance === "number" ? body.walletBalance : 150;
    const distanceKm =
      typeof body.distanceKm === "number" ? body.distanceKm : 1.8;

    const { outlet, items, coupons } = await getMenuBundle(body.outletSlug);

    const bill = computeServerBill({
      cartItems,
      menuItems: items,
      outlet,
      coupons,
      orderType,
      couponCode,
      useWallet,
      walletBalance,
      distanceKm,
    });

    return NextResponse.json(bill);
  } catch (err) {
    console.error("Cart price calculation error:", err);
    return NextResponse.json(
      { error: "Failed to compute cart bill" },
      { status: 500 }
    );
  }
}
