import React from "react";
import { notFound } from "next/navigation";
import { getMenuBundle } from "@/lib/server-db";
import { OrderMenuClient } from "@/components/menu/OrderMenuClient";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

async function getOutletMenu(slug: string) {
  try {
    const bundle = await getMenuBundle(slug);
    // The development data layer can fall back to the default outlet.
    if (bundle.outlet.slug !== slug) notFound();
    return bundle;
  } catch (error) {
    // Supabase's single-row lookup reports a missing outlet with PGRST116.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "PGRST116") {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { outlet } = await getOutletMenu((await params).slug);
  // Homepage renders the same menu, so consolidate this duplicate to its canonical.
  return pageMetadata(
    "Burger Budds Menu | Order Burgers Online in Gwalior",
    `Explore burgers, fries and shakes from ${outlet.name}. Order fast food online for delivery or takeaway in Gwalior.`,
    "/"
  );
}

export default async function OrderMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { outlet, categories, items, coupons } = await getOutletMenu((await params).slug);
  return (
    <OrderMenuClient
      initialOutlet={outlet}
      initialCategories={categories}
      initialItems={items}
      initialCoupons={coupons}
    />
  );
}
