"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RegisteredRider } from "@/types/database";

export function RegisteredRiderPicker({ orderId, value, onChange, disabled }: {
  orderId: string; value: string; onChange: (id: string) => void; disabled: boolean;
}) {
  const [riders, setRiders] = useState<RegisteredRider[]>([]);
  const [message, setMessage] = useState("Loading registered riders…");
  useEffect(() => {
    const controller = new AbortController();
    setRiders([]);
    setMessage("Loading registered riders…");
    void (async () => {
      try {
        const session = await getSupabaseBrowserClient()?.auth.getSession();
        const token = session?.data.session?.access_token;
        if (!token || session?.error) throw new Error("Sign in again to load registered riders.");
        const response = await fetch(`/api/riders?orderId=${encodeURIComponent(orderId)}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Registered riders could not be loaded.");
        if (!controller.signal.aborted) {
          setRiders(data.riders);
          setMessage(data.riders.length ? "Registered riders receive this order in their rider dashboard." : "No registered riders yet. Use manual handover or contact your administrator.");
        }
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Registered riders unavailable. Manual handover is still available.");
      }
    })();
    return () => controller.abort();
  }, [orderId]);
  return <div className="space-y-2">
    <label className="text-xs font-bold" htmlFor={`registered-rider-${orderId}`}>Assign rider</label>
    <select id={`registered-rider-${orderId}`} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} className="w-full min-h-[44px] rounded-xs border border-border-muted bg-surface-base px-3 text-sm">
      <option value="">Manual rider — enter contact details</option>
      {riders.map(rider => <option key={rider.id} value={rider.id}>{rider.name} · {rider.phone}</option>)}
    </select>
    <p role="status" className="text-xs text-text-muted">{message}</p>
    {!value && <p className="text-xs text-text-muted">Manual details appear on customer tracking, but do not grant rider dashboard access.</p>}
  </div>;
}
