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
    `${outlet.name.replace(" — ", " ")} ${outlet.city || ""} Online Ordering`,
    `Explore burgers, fries and shakes from ${outlet.name}. Order fast food online for delivery or takeaway in Gwalior.`,
    `/order/${outlet.slug}`
  );
}

export default async function OrderMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { outlet, categories, items, coupons } = await getOutletMenu((await params).slug);
  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({"@context":"https://schema.org","@type":"Restaurant",name:outlet.name,url:`https://www.burgerbudds.in/order/${outlet.slug}`,address:{"@type":"PostalAddress",streetAddress:outlet.address,addressLocality:outlet.city || outlet.area,addressCountry:"IN"},geo:{"@type":"GeoCoordinates",latitude:outlet.lat,longitude:outlet.lng},telephone:outlet.phone || undefined,openingHoursSpecification:Object.entries(outlet.opening_hours || {}).filter(([,h])=>h).map(([d,h])=>({"@type":"OpeningHoursSpecification",dayOfWeek:d,opens:h?.open,closes:h?.close})),hasMenu:{"@type":"Menu",hasMenuSection:categories.map(c=>({"@type":"MenuSection",name:c.name,hasMenuItem:items.filter(i=>i.category_id===c.id).map(i=>({"@type":"MenuItem",name:i.name,description:i.description,offers:{"@type":"Offer",price:i.price,priceCurrency:"INR"}}))}))}}).replace(/</g,"\u003c")}} />
    <OrderMenuClient
      initialOutlet={outlet}
      initialCategories={categories}
      initialItems={items}
      initialCoupons={coupons}
    />
    </>
  );
}
