import React from "react";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { GlobalFooter } from "@/components/layout/GlobalFooter";

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      <GlobalHeader />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-4">
        <h1 className="text-2xl font-extrabold">
          Refund & Cancellation Policy
        </h1>
        <div className="p-6 rounded-md bg-surface-base border border-border-subtle shadow-card space-y-3 text-xs sm:text-sm text-text-secondary leading-relaxed">
          <p>
            Customers can cancel an order free of charge while the order status
            is &ldquo;Placed&rdquo;. If an order is rejected by the outlet due
            to stock unavailability or kitchen closure, 100% of any online
            payment or BB Coins used is refunded automatically.
          </p>
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}
