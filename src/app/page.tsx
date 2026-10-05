import React from "react";
import { getMenuBundle } from "@/lib/server-db";
import { DEFAULT_OUTLET_SLUG } from "@/lib/seed-data";
import { OrderMenuClient } from "@/components/menu/OrderMenuClient";
import { brandStructuredData, HOME_DESCRIPTION, HOME_TITLE, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(HOME_TITLE, HOME_DESCRIPTION, "/");

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { outlet, categories, items, coupons } = await getMenuBundle(
    DEFAULT_OUTLET_SLUG
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(brandStructuredData).replace(/</g, "\\u003c") }}
      />
      <OrderMenuClient
        initialOutlet={outlet}
        initialCategories={categories}
        initialItems={items}
        initialCoupons={coupons}
      />
    </>
  );
}
