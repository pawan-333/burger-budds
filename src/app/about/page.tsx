import React from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("About Burger Budds | Burgers in Gwalior", "Discover Burger Budds in Gwalior and our passion for freshly prepared smash burgers, paneer burgers, crispy fries and thick shakes.", "/about");
import Link from "next/link";
import { Flame, Heart, ShieldCheck, Utensils } from "lucide-react";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { DEFAULT_OUTLET_SLUG } from "@/lib/seed-data";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      <GlobalHeader />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        <section className="rounded-md bg-brand-secondary text-text-onSecondary p-8 shadow-card space-y-4">
          <span className="px-3 py-1 rounded-pill bg-brand-primary text-text-onPrimary text-xs font-extrabold uppercase">
            Born in Gwalior
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-primary">
            About Burger Budds
          </h1>
          <p className="text-sm sm:text-base text-text-onSecondary/90 max-w-2xl leading-relaxed">
            Burger Budds started with one obsession: crafting the juiciest
            caramelized smash burgers, crunchiest malai paneer burgers, and
            thickest Belgian chocolate shakes for Gwalior&apos;s food lovers.
          </p>
          <div>
            <Link
              href={`/order/${DEFAULT_OUTLET_SLUG}`}
              className="min-h-[44px] px-6 py-2.5 rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-sm inline-flex items-center gap-2 shadow-1"
            >
              <Utensils className="w-4 h-4" />
              <span>Order Now from Vinay Nagar Outlet</span>
            </Link>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-md bg-surface-base border border-border-subtle shadow-card space-y-2">
            <Flame className="w-6 h-6 text-brand-secondary" />
            <h2 className="text-base font-extrabold">100% Freshly Smashed</h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Every patty is seared to order on a blazing-hot flat-top grill,
              locking in juices and creating our signature crispy lace edges.
            </p>
          </div>
          <div className="p-5 rounded-md bg-surface-base border border-border-subtle shadow-card space-y-2">
            <ShieldCheck className="w-6 h-6 text-brand-secondary" />
            <h2 className="text-base font-extrabold">Separate Veg & Non-Veg</h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              We maintain strictly separated grills, fryers, and prep stations
              for our vegetarian and non-vegetarian items.
            </p>
          </div>
          <div className="p-5 rounded-md bg-surface-base border border-border-subtle shadow-card space-y-2">
            <Heart className="w-6 h-6 text-brand-secondary" />
            <h2 className="text-base font-extrabold">Direct-to-You Savings</h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Ordering directly on Burger Budds gives you FLAT129 deals, zero
              inflated menu prices, and 150 welcome BB Coins.
            </p>
          </div>
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}
