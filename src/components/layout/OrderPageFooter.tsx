"use client";
import { useApp } from "@/context/AppContext";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const footerClassName =
  "border-t border-border-subtle bg-surface-base px-4 pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 lg:pb-6";

export function FoodLicenceFooter() {
  const { activeOutlet } = useApp();
  return (
    <footer className={footerClassName} aria-label="Food licence">
      <div className="max-w-7xl mx-auto flex items-start gap-3">
        <ShieldCheck aria-hidden="true" className="w-5 h-5 shrink-0 text-brand-secondary mt-0.5" />
        <div className="space-y-1 text-sm">
          <h2 className="font-bold text-text-primary">Food Licence</h2>
          <p className="text-text-secondary break-words">{activeOutlet.fssai_number ? `FSSAI Lic. No. ${activeOutlet.fssai_number}` : "Food licence details awaiting verification"}</p>
        </div>
      </div>
    </footer>
  );
}

export function CancellationPolicyFooter() {
  return (
    <footer className={footerClassName} aria-label="Cancellation policy">
      <div className="max-w-6xl mx-auto space-y-2 text-sm leading-relaxed">
        <h2 className="font-bold text-text-primary">Cancellation Policy</h2>
        <p className="text-text-secondary">
          Customers can cancel an order free of charge while the order status
          is &ldquo;Placed&rdquo;. If an order is rejected by the outlet due
          to stock unavailability or kitchen closure, 100% of any online
          payment or BB Coins used is refunded automatically.
        </p>
        <Link
          href="/refund-policy"
          className="inline-flex min-h-[44px] items-center font-semibold text-brand-secondary underline underline-offset-4 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
        >
          Read Refund &amp; Cancellation Policy
        </Link>
      </div>
    </footer>
  );
}
