"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { MerchantLogin } from "@/components/merchant/MerchantLogin";

type SavedRider = { rider_id: string; is_active: boolean; rider: { name: string; phone: string }; outlet: { name: string } };

export default function RiderPinSetup() {
  const [riders, setRiders] = useState<SavedRider[]>([]);
  const [login, setLogin] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [riderId, setRiderId] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const token = async () => (await getSupabaseBrowserClient()?.auth.getSession())?.data.session?.access_token;
  const load = useCallback(async () => {
    try {
      const bearer = await token();
      if (!bearer) { setLogin(true); setRiders([]); return; }
      setLogin(false);
      const response = await fetch("/api/admin/riders", { headers: { Authorization: `Bearer ${bearer}` }, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) { setRiders([]); throw new Error(body.error || "Could not load riders."); }
      setRiders(body.riders); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not connect."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (login) return <MerchantLogin onSuccess={() => void load()} />;
  return <main className="min-h-screen bg-surface-page px-4 py-8"><div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-card">
    <Link href="/admin" className="text-sm font-bold text-brand-secondary">← Administration</Link>
    <h1 className="mt-4 text-2xl font-extrabold">Rider PIN setup</h1>
    <p className="mt-2 text-sm text-text-muted">Set a different private PIN for each rider. Share it with that rider securely. PINs cannot be viewed here after saving.</p>
    {error && <p role="alert" className="mt-4 text-sm text-status-error">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm text-brand-secondary">{message}</p>}
    <form className="mt-6 space-y-4" onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setError(""); setMessage("");
      try {
        const bearer = await token(); if (!bearer) { setLogin(true); setPin(""); return; }
        const response = await fetch("/api/admin/riders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` }, body: JSON.stringify({ riderId, pin }) });
        const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not save PIN.");
        setPin(""); setMessage("PIN saved. This rider can now sign in with their mobile number."); await load();
      } catch (err) { setError(err instanceof Error ? err.message : "Could not save PIN."); }
      finally { setBusy(false); }
    }}>
      <label className="block text-sm font-bold">Saved rider<select required value={riderId} onChange={event => { setRiderId(event.target.value); setPin(""); setMessage(""); }} className="mt-2 min-h-[48px] w-full rounded-md border border-border-muted px-3"><option value="">Select a rider</option>{riders.map(rider => <option key={rider.rider_id} value={rider.rider_id}>{rider.rider.name} · {rider.rider.phone} · {rider.outlet.name}{rider.is_active ? "" : " · PIN setup pending"}</option>)}</select></label>
      <label className="block text-sm font-bold">New 6-digit PIN<input type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="new-password" required value={pin} onChange={event => setPin(event.target.value)} className="mt-2 min-h-[48px] w-full rounded-md border border-border-muted px-3" /></label>
      <button disabled={busy || !riderId} className="min-h-[48px] w-full rounded-md bg-brand-secondary px-4 font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save PIN & activate rider"}</button>
    </form>
    {!riders.length && <p className="mt-4 text-sm text-text-muted">No saved rider accounts available. <button onClick={() => void load()} className="min-h-[44px] font-bold underline">Retry</button></p>}
  </div></main>;
}
