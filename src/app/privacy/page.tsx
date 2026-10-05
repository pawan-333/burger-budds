import React from "react";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { GlobalFooter } from "@/components/layout/GlobalFooter";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      <GlobalHeader />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-4">
        <h1 className="text-2xl font-extrabold">Privacy Policy</h1>
        <div className="p-6 rounded-md bg-surface-base border border-border-subtle shadow-card space-y-3 text-xs sm:text-sm text-text-secondary leading-relaxed">
          <p>
            Burger Budds collects your phone number, name, and pinned delivery
            coordinates solely to fulfill your food orders and send live order
            tracking updates.
          </p>
          <p>
            Promotional messages are strictly opt-in via the checkbox on the
            checkout page.
          </p>
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}
