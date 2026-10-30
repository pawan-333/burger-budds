"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { openCashfreeCheckout } from "@/lib/cashfree-checkout";

interface Props { orderId: string; paid: boolean; cancelled: boolean; mode: "sandbox" | "production" | null; onVerified: () => void; }

export function CashfreePayment({ orderId, paid, cancelled, mode, onVerified }: Props) {
  const testPayment = mode !== "production";
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [refundRequired, setRefundRequired] = useState(false);
  const inFlight = useRef(false);
  const autoStarted = useRef(false);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setChecking(true);
    try {
      const response = await fetch("/api/payments/cashfree/status", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to verify payment.");
      setError(null); setExpired(Boolean(data.expired)); setRefundRequired(Boolean(data.refundRequired));
      if (data.paid || data.expired) onVerifiedRef.current();
      return Boolean(data.paid);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Payment verification unavailable.");
      return undefined;
    } finally { inFlight.current = false; setChecking(false); }
  }, [orderId]);

  const pay = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const verified = await check();
      if (verified !== false) return;
      await openCashfreeCheckout(orderId);
      await check();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to start payment.");
    } finally { setBusy(false); }
  }, [check, orderId]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("pay") === "1" && !paid && !cancelled && !autoStarted.current) {
      autoStarted.current = true;
      void pay();
    } else { void check(); }
    if (paid || cancelled) return;
    const interval = window.setInterval(() => { if (!document.hidden) void check(); }, 15000);
    return () => window.clearInterval(interval);
  }, [paid, cancelled, check, pay]);

  return <section className="rounded-md border border-border-subtle bg-surface-base p-5 space-y-3" aria-label="Payment status">
    <h2 className="font-extrabold">{testPayment ? "UPI · Test payment" : "UPI payment"}</h2>
    <p className="text-sm text-text-secondary">{paid
      ? (refundRequired || cancelled ? "Payment received for a cancelled order. Contact support for refund reconciliation." : "Payment verified. Your order has been sent to the outlet.")
      : expired ? "Payment session expired. Place a new order to try again."
      : cancelled ? "This order is cancelled. Check payment status if your payment was processing."
      : `Payment is pending. The outlet will receive your order after payment is verified.${testPayment ? " This is a test payment; no real money is collected." : ""}`}</p>
    {error && <p role="alert" className="text-sm text-status-error">{error}</p>}
    <div className="flex flex-wrap gap-3">
      {!paid && !cancelled && !expired && <button type="button" disabled={busy || checking} onClick={() => void pay()} className="min-h-[44px] rounded-xs bg-brand-primary px-4 py-2 font-bold disabled:opacity-50">{busy ? "Opening checkout…" : testPayment ? "Pay with UPI (Test)" : "Pay with UPI"}</button>}
      <button type="button" disabled={busy || checking} onClick={() => void check()} className="min-h-[44px] rounded-xs border border-border-muted px-4 py-2 font-bold disabled:opacity-50">{checking ? "Checking…" : "Refresh payment status"}</button>
    </div>
  </section>;
}
