import React from "react";
import { getMenuBundle } from "@/lib/server-db";
import { DEFAULT_OUTLET_SLUG } from "@/lib/seed-data";
import { OrderMenuClient } from "@/components/menu/OrderMenuClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { outlet, categories, items, coupons } = await getMenuBundle(
    DEFAULT_OUTLET_SLUG
  );

  return (
    <OrderMenuClient
      initialOutlet={outlet}
      initialCategories={categories}
      initialItems={items}
      initialCoupons={coupons}
    />
  );
}
