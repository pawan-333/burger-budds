import React from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Terms & Conditions | Burger Budds", "Read the terms and conditions for Burger Budds online ordering, including order charges and cancellation conditions.", "/terms");
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { GlobalFooter } from "@/components/layout/GlobalFooter";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      <GlobalHeader />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-4">
        <h1 className="text-2xl font-extrabold">Terms & Conditions</h1>
        <div className="p-6 rounded-md bg-surface-base border border-border-subtle shadow-card space-y-3 text-xs sm:text-sm text-text-secondary leading-relaxed">
          <p>
            Welcome to Burger Budds Online Ordering. All menu prices are
            exclusive of applicable 5% GST and delivery/platform charges shown
            transparently at checkout.
          </p>
          <p>
            Orders can be cancelled by the customer while in &ldquo;Placed&rdquo;
            status before kitchen acceptance. Once preparation begins,
            cancellations are not permitted.
          </p>
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}
