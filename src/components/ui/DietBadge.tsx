"use client";

import React from "react";
import { DietType } from "@/types/database";

interface DietBadgeProps {
  diet: DietType;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function DietBadge({
  diet,
  showLabel = false,
  size = "md",
}: DietBadgeProps) {
  const boxSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const dotSize = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";

  const borderClass =
    diet === "veg"
      ? "border-veg text-veg"
      : diet === "egg"
      ? "border-egg text-egg"
      : "border-nonveg text-nonveg";

  const fillClass =
    diet === "veg"
      ? "bg-veg"
      : diet === "egg"
      ? "bg-egg"
      : "bg-nonveg";

  const label =
    diet === "veg" ? "Veg" : diet === "egg" ? "Contains Egg" : "Non-Veg";

  return (
    <span
      className="inline-flex items-center gap-1.5 select-none"
      title={label}
      aria-label={label}
    >
      <span
        className={`${boxSize} border-2 ${borderClass} rounded-[4px] inline-flex items-center justify-center bg-surface-base shrink-0`}
      >
        {diet === "nonveg" ? (
          <span
            className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-nonveg"
            aria-hidden="true"
          />
        ) : (
          <span
            className={`${dotSize} rounded-pill ${fillClass}`}
            aria-hidden="true"
          />
        )}
      </span>
      {showLabel && (
        <span className="text-xs font-semibold text-text-secondary">
          {label}
        </span>
      )}
    </span>
  );
}
