"use client";

import React, { useState } from "react";
import { Flame, Sparkles, Star } from "lucide-react";
import { MenuItem } from "@/types/database";
import { DietBadge } from "@/components/ui/DietBadge";
import { useApp } from "@/context/AppContext";

interface MenuItemCardProps {
  item: MenuItem;
  onSelectItem: (item: MenuItem) => void;
}

export function MenuItemCard({ item, onSelectItem }: MenuItemCardProps) {
  const { getItemQtyInCart, updateSimpleItemQty } = useApp();
  const [expandedDesc, setExpandedDesc] = useState(false);

  const qty = getItemQtyInCart(item.id);
  const hasCustomizations =
    (item.variants && item.variants.length > 0) ||
    (item.addon_groups && item.addon_groups.length > 0);

  return (
    <article
      className={`group relative rounded-md bg-surface-base border border-border-subtle p-4 shadow-card hover:border-border-muted transition duration-fast flex justify-between gap-4 ${
        !item.is_available ? "opacity-65" : ""
      }`}
    >
      {/* Left Content Column */}
      <div
        onClick={() => onSelectItem(item)}
        className="flex-1 min-w-0 flex flex-col justify-between cursor-pointer"
      >
        <div className="space-y-1.5">
          {/* Top Badges Row: Diet + Bestseller / New / Rating */}
          <div className="flex items-center flex-wrap gap-1.5">
            <DietBadge diet={item.diet} size="sm" />
            {item.is_bestseller && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-xs bg-brand-primary text-text-onPrimary text-[10px] font-extrabold uppercase tracking-wide">
                <Flame className="w-3 h-3" />
                Bestseller
              </span>
            )}
            {item.is_new && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-xs bg-brand-secondary text-text-onSecondary text-[10px] font-extrabold uppercase tracking-wide">
                <Sparkles className="w-3 h-3" />
                New
              </span>
            )}
            {item.rating >= 4.0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-xs bg-status-openSoft text-status-open text-[11px] font-extrabold">
                <Star className="w-3 h-3 fill-current" />
                {item.rating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Item Name (Clamped to 2 lines) */}
          <h3 className="text-sm sm:text-base font-extrabold text-text-primary line-clamp-2 group-hover:text-brand-secondary transition duration-fast">
            {item.name}
          </h3>

          {/* Price Row */}
          <div className="flex items-baseline gap-2 pt-0.5">
            <span className="text-sm sm:text-base font-extrabold text-text-primary">
              ₹{item.price}
            </span>
            {item.original_price && (
              <span className="text-xs font-semibold text-text-muted line-through">
                ₹{item.original_price}
              </span>
            )}
            {item.is_on_offer && (
              <span className="text-[11px] font-extrabold text-status-open">
                FLAT129 Eligible
              </span>
            )}
          </div>

          {/* Description (2-line clamp + Read more) */}
          <div className="pt-1">
            <p
              className={`text-xs font-medium text-text-secondary leading-relaxed ${
                expandedDesc ? "" : "line-clamp-2"
              }`}
            >
              {item.description}
            </p>
            {item.description.length > 75 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedDesc((prev) => !prev);
                }}
                className="mt-0.5 text-xs font-extrabold text-brand-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary rounded-xs"
              >
                {expandedDesc ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Image + Overlapping ADD / Stepper Button */}
      <div className="relative w-28 sm:w-32 shrink-0 flex flex-col items-center pb-4">
        <button
          type="button"
          onClick={() => onSelectItem(item)}
          aria-label={`View details for ${item.name}`}
          className="w-28 h-28 sm:w-32 sm:h-28 rounded-sm overflow-hidden bg-surface-raised border border-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className={`w-full h-full object-cover transition duration-normal group-hover:scale-105 ${
              !item.is_available ? "grayscale" : ""
            }`}
          />
        </button>

        {/* Overlapping Action Button / Stepper */}
        <div className="absolute bottom-0 inset-x-2 flex flex-col items-center">
          {!item.is_available ? (
            <button
              type="button"
              disabled
              className="w-full min-h-[38px] px-3 rounded-xs bg-surface-raised border border-border-muted text-text-muted font-extrabold text-xs cursor-not-allowed shadow-1"
            >
              Unavailable
            </button>
          ) : qty === 0 ? (
            <button
              type="button"
              onClick={() => {
                if (hasCustomizations) {
                  onSelectItem(item);
                } else {
                  updateSimpleItemQty(item, 1);
                }
              }}
              aria-label={`Add ${item.name} to cart`}
              className="w-full min-h-[40px] px-3 rounded-xs bg-surface-base hover:bg-brand-primary text-text-primary border-2 border-brand-primary font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 transition duration-fast"
            >
              <span>ADD</span>
              <span className="text-base leading-none">+</span>
            </button>
          ) : (
            <div className="w-full min-h-[40px] rounded-xs bg-brand-primary text-text-onPrimary font-extrabold text-sm flex items-center justify-between px-1 shadow-card border border-text-primary/15">
              <button
                type="button"
                onClick={() => updateSimpleItemQty(item, -1)}
                aria-label={`Decrease quantity of ${item.name}`}
                className="min-w-[32px] min-h-[36px] rounded-xs hover:bg-brand-primaryHover flex items-center justify-center text-base font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
              >
                −
              </button>
              <span aria-live="polite" className="px-1 text-xs sm:text-sm font-extrabold">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (hasCustomizations) {
                    onSelectItem(item);
                  } else {
                    updateSimpleItemQty(item, 1);
                  }
                }}
                aria-label={`Increase quantity of ${item.name}`}
                className="min-w-[32px] min-h-[36px] rounded-xs hover:bg-brand-primaryHover flex items-center justify-center text-base font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
              >
                +
              </button>
            </div>
          )}

          {hasCustomizations && item.is_available && (
            <span className="mt-0.5 text-[10px] font-semibold text-text-muted">
              Customisable
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
