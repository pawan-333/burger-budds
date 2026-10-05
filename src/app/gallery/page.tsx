import React from "react";
import Link from "next/link";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { DEFAULT_OUTLET_SLUG, SEED_ITEMS } from "@/lib/seed-data";

export default function GalleryPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      <GlobalHeader />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">Burger Budds Gallery</h1>
            <p className="text-xs sm:text-sm text-text-secondary">
              Handcrafted smash burgers, crispy paneer specials, and loaded
              crinkle fries.
            </p>
          </div>
          <Link
            href={`/order/${DEFAULT_OUTLET_SLUG}`}
            className="min-h-[44px] px-5 py-2 rounded-xs bg-brand-primary text-text-onPrimary font-extrabold text-xs sm:text-sm inline-flex items-center"
          >
            Order Full Menu →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {SEED_ITEMS.map((item) => (
            <div
              key={item.id}
              className="rounded-md overflow-hidden bg-surface-base border border-border-subtle shadow-card"
            >
              <div className="h-52 w-full bg-surface-raised">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <p className="text-sm font-extrabold text-text-primary">
                  {item.name}
                </p>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}
