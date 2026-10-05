import React from "react";
import type { Metadata } from "next";
import { getMenuBundle } from "@/lib/server-db";
import { OrderMenuClient } from "@/components/menu/OrderMenuClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const { outlet } = await getMenuBundle(params.slug);
  return {
    title: `${outlet.name} | Order Online — Burger Budds`,
    description: `Order hot & crispy smash burgers, peri-peri crinkle fries, and thick shakes online from ${outlet.name}. Use code FLAT129 for instant savings!`,
    openGraph: {
      title: `${outlet.name} — Online Delivery & Takeaway`,
      description: `Freshly smashed burgers delivered in ${outlet.prep_time_min + 10} mins across ${outlet.area}.`,
      type: "website",
    },
  };
}

export default async function OrderMenuPage({
  params,
}: {
  params: { slug: string };
}) {
  const { outlet, categories, items, coupons } = await getMenuBundle(
    params.slug
  );

  // Restaurant + Menu JSON-LD Structured Data (PLAN.md section 9)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: outlet.name,
    servesCuisine: ["Burgers", "American", "Fast Food", "Beverages"],
    telephone: outlet.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: outlet.address,
      addressLocality: "Gwalior",
      addressRegion: "MP",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: outlet.lat,
      longitude: outlet.lng,
    },
    hasMenu: {
      "@type": "Menu",
      hasMenuSection: categories.map((cat) => ({
        "@type": "MenuSection",
        name: cat.name,
        hasMenuItem: items
          .filter((i) => i.category_id === cat.id)
          .map((i) => ({
            "@type": "MenuItem",
            name: i.name,
            description: i.description,
            offers: {
              "@type": "Offer",
              price: i.price,
              priceCurrency: "INR",
            },
          })),
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
