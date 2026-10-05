"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Share2, Star, X } from "lucide-react";
import {
  CartAddonSelection,
  ItemVariant,
  MenuItem,
} from "@/types/database";
import { DietBadge } from "@/components/ui/DietBadge";
import { useApp } from "@/context/AppContext";

interface ItemDetailModalProps {
  item: MenuItem | null;
  onClose: () => void;
}

export function ItemDetailModal({ item, onClose }: ItemDetailModalProps) {
  const { addToCart } = useApp();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [selectedVariant, setSelectedVariant] = useState<ItemVariant | null>(
    null
  );
  const [selectedAddons, setSelectedAddons] = useState<CartAddonSelection[]>(
    []
  );
  const [qty, setQty] = useState<number>(1);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (item) {
      setSelectedVariant(item.variants?.[0] || null);
      setSelectedAddons([]);
      setQty(1);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [item]);

  // Backdrop click fallback
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleBackdrop = (e: MouseEvent) => {
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!inside) onClose();
    };
    dialog.addEventListener("click", handleBackdrop);
    return () => dialog.removeEventListener("click", handleBackdrop);
  }, [onClose]);

  if (!item) return null;

  const variantDelta = selectedVariant ? Number(selectedVariant.price_delta) : 0;
  const addonsDelta = selectedAddons.reduce((s, a) => s + Number(a.price), 0);
  const unitTotal = Number(item.price) + variantDelta + addonsDelta;
  const lineTotal = unitTotal * qty;

  const toggleAddon = (addon: { id: string; name: string; price: number }) => {
    setSelectedAddons((prev) => {
      const exists = prev.some((a) => a.id === addon.id);
      if (exists) {
        return prev.filter((a) => a.id !== addon.id);
      }
      return [
        ...prev,
        { id: addon.id, name: addon.name, price: Number(addon.price) },
      ];
    });
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="item-modal-title"
      className="w-full max-w-lg rounded-md bg-surface-base text-text-primary p-0 shadow-floating backdrop:bg-surface-dark/60 backdrop:backdrop-blur-xs overflow-hidden"
    >
      {/* Top Big Image + Share & Close Buttons */}
      <div className="relative h-60 sm:h-64 w-full bg-surface-raised">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share item link"
            className="min-h-[44px] min-w-[44px] rounded-pill bg-surface-base/90 hover:bg-surface-base text-text-primary shadow-floating inline-flex items-center justify-center transition duration-fast"
          >
            {copiedShare ? (
              <Check className="w-4 h-4 text-status-open" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close item details"
            className="min-h-[44px] min-w-[44px] rounded-pill bg-surface-base/90 hover:bg-surface-base text-text-primary shadow-floating inline-flex items-center justify-center transition duration-fast"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="p-5 max-h-[55vh] overflow-y-auto space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DietBadge diet={item.diet} showLabel />
              {item.is_bestseller && (
                <span className="px-2 py-0.5 rounded-xs bg-brand-primary text-text-onPrimary text-[11px] font-extrabold">
                  ★ Bestseller
                </span>
              )}
              {item.is_new && (
                <span className="px-2 py-0.5 rounded-xs bg-brand-secondary text-text-onSecondary text-[11px] font-extrabold">
                  NEW
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-status-openSoft text-status-open text-xs font-extrabold">
              <Star className="w-3.5 h-3.5 fill-current" />
              {item.rating.toFixed(1)}
            </span>
          </div>

          <h2
            id="item-modal-title"
            className="text-lg font-extrabold text-text-primary"
          >
            {item.name}
          </h2>

          <div className="flex items-baseline gap-2">
            <span className="text-base font-extrabold text-text-primary">
              ₹{item.price}
            </span>
            {item.original_price && (
              <span className="text-xs font-semibold text-text-muted line-through">
                ₹{item.original_price}
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm font-medium text-text-secondary leading-relaxed">
            {item.description}
          </p>
        </div>

        {/* Variants (Size / Patty Selection) */}
        {item.variants && item.variants.length > 0 && (
          <div className="p-4 rounded-sm bg-surface-raised border border-border-subtle space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-text-primary">
                Choose Size / Preparation
              </h3>
              <span className="text-[11px] font-bold text-brand-secondary">
                Required • Select 1
              </span>
            </div>
            <div className="space-y-2">
              {item.variants.map((variant) => {
                const isChecked = selectedVariant?.id === variant.id;
                return (
                  <label
                    key={variant.id}
                    className={`min-h-[44px] px-3 py-2 rounded-xs border flex items-center justify-between cursor-pointer transition duration-fast ${
                      isChecked
                        ? "border-brand-secondary bg-brand-secondarySoft/50"
                        : "border-border-subtle bg-surface-base"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="item-variant"
                        checked={isChecked}
                        onChange={() => setSelectedVariant(variant)}
                        className="w-4 h-4 accent-brand-secondary"
                      />
                      <span className="text-xs sm:text-sm font-bold text-text-primary">
                        {variant.name}
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-text-secondary">
                      {variant.price_delta > 0
                        ? `+ ₹${variant.price_delta}`
                        : "Included"}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Add-on Groups */}
        {item.addon_groups &&
          item.addon_groups.map((group) => (
            <div
              key={group.id}
              className="p-4 rounded-sm bg-surface-raised border border-border-subtle space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-text-primary">
                  {group.name}
                </h3>
                <span className="text-[11px] font-bold text-text-muted">
                  Optional • Up to {group.max_select}
                </span>
              </div>
              <div className="space-y-2">
                {group.addons.map((addon) => {
                  const checked = selectedAddons.some((a) => a.id === addon.id);
                  return (
                    <label
                      key={addon.id}
                      className={`min-h-[44px] px-3 py-2 rounded-xs border flex items-center justify-between cursor-pointer transition duration-fast ${
                        checked
                          ? "border-brand-secondary bg-brand-secondarySoft/50"
                          : "border-border-subtle bg-surface-base"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAddon(addon)}
                          className="w-4 h-4 accent-brand-secondary"
                        />
                        <DietBadge diet={addon.diet} size="sm" />
                        <span className="text-xs sm:text-sm font-bold text-text-primary">
                          {addon.name}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-text-secondary">
                        + ₹{addon.price}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
      </div>

      {/* Sticky Bottom Yellow Bar: "₹269.00 | Add to Cart" */}
      <div className="p-4 bg-surface-base border-t border-border-subtle flex items-center gap-3">
        <div className="flex items-center border border-border-muted rounded-xs bg-surface-raised h-11">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="min-w-[40px] h-full font-extrabold text-base text-text-primary hover:bg-surface-base"
          >
            −
          </button>
          <span className="px-3 text-sm font-extrabold text-text-primary">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            aria-label="Increase quantity"
            className="min-w-[40px] h-full font-extrabold text-base text-text-primary hover:bg-surface-base"
          >
            +
          </button>
        </div>

        <button
          type="button"
          disabled={!item.is_available}
          onClick={() => {
            addToCart({
              item,
              variant: selectedVariant,
              addons: selectedAddons,
              qty,
            });
            onClose();
          }}
          className="flex-1 min-h-[44px] px-4 rounded-xs bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-text-onPrimary font-extrabold text-sm flex items-center justify-between shadow-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 transition duration-fast"
        >
          <span>₹{lineTotal.toFixed(2)}</span>
          <span>{item.is_available ? "Add to Cart" : "Unavailable"}</span>
        </button>
      </div>
    </dialog>
  );
}
