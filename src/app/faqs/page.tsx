import React from "react";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { GlobalFooter } from "@/components/layout/GlobalFooter";

export default function FaqsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      <GlobalHeader />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-5">
        <h1 className="text-2xl font-extrabold">Frequently Asked Questions</h1>
        <div className="space-y-4">
          <div className="p-5 rounded-md bg-surface-base border border-border-subtle shadow-card space-y-1">
            <h2 className="text-sm font-extrabold">
              What is the delivery radius for Burger Budds Gwalior?
            </h2>
            <p className="text-xs text-text-secondary">
              We deliver within a 5.0 km radius of our Vinay Nagar Sector 3
              outlet to ensure every burger arrives piping hot and crispy.
            </p>
          </div>
          <div className="p-5 rounded-md bg-surface-base border border-border-subtle shadow-card space-y-1">
            <h2 className="text-sm font-extrabold">
              How do BB Coins work?
            </h2>
            <p className="text-xs text-text-secondary">
              1 BB Coin equals ₹1. New users receive 150 BB Coins upon login
              which can be applied directly in the Savings Corner at checkout.
            </p>
          </div>
          <div className="p-5 rounded-md bg-surface-base border border-border-subtle shadow-card space-y-1">
            <h2 className="text-sm font-extrabold">
              Can I pay via Cash on Delivery (COD)?
            </h2>
            <p className="text-xs text-text-secondary">
              Yes! Cash on Delivery and UPI/Card options are supported at
              checkout.
            </p>
          </div>
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}
