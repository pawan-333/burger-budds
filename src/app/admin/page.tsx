"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MerchantLogin } from "@/components/merchant/MerchantLogin";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Outlet } from "@/types/database";
type Store = Outlet & { is_active: boolean };
type Merchant = { id: string; email: string; outlet_id: string; role: string };
const inputClass = "w-full min-h-[44px] border border-border-muted rounded-xs px-3 bg-surface-base";
const buttonClass = "min-h-[44px] px-4 py-2 rounded-xs bg-brand-primary text-text-onPrimary font-bold disabled:opacity-50";
export default function AdminPage() {
  const [access, setAccess] = useState("checking");
  const [stores, setStores] = useState<Store[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const client = getSupabaseBrowserClient();
      const user = client ? (await client.auth.getUser()).data.user : null;
      if (!user) { setAccess("login"); return; }
      const response = await fetch("/api/admin", { cache: "no-store" });
      if (response.status === 403) { setAccess("denied"); return; }
      if (!response.ok) throw new Error();
      const data = await response.json();
      setStores(data.stores); setMerchants(data.merchants); setAccess("allowed");
    } catch { setMessage("Unable to load admin dashboard. Please retry."); setAccess("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function act(body: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error); return false; }
      await load(); setMessage("Saved successfully."); return true;
    } catch { setMessage("Unable to save. Please retry."); return false; }
    finally { setBusy(false); }
  }
  async function signOut() { await getSupabaseBrowserClient()?.auth.signOut(); setStores([]); setMerchants([]); setAccess("login"); }
  if (access === "login") return <MerchantLogin onSuccess={() => void load()} />;
  if (access !== "allowed") return <main className="min-h-screen p-6 bg-surface-page space-y-4"><h1 className="text-2xl font-bold">Burger Budds Super Admin</h1><p role="status">{access === "checking" ? "Checking access…" : access === "denied" ? "Super admin access required." : message}</p><button className={buttonClass} onClick={() => void load()}>Retry</button><button className={buttonClass} onClick={() => void signOut()}>Sign in with another account</button></main>;
  return <main className="min-h-screen bg-surface-page text-text-primary p-4 sm:p-8"><div className="max-w-6xl mx-auto space-y-6">
    <header className="flex flex-wrap justify-between gap-4"><div><h1 className="text-2xl font-extrabold">Burger Budds Super Admin</h1><p className="text-text-secondary">Manage all stores and merchant access.</p></div><button className={buttonClass} onClick={() => void signOut()}>Sign out</button></header>
    {message && <p role="status" className="p-4 bg-surface-base border border-border-subtle rounded-md">{message}</p>}
    <section className="space-y-3"><h2 className="text-xl font-bold">Stores</h2>{stores.map(store => <article key={store.id} className="p-5 bg-surface-base border border-border-subtle rounded-md flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-bold">{store.name}</h3><p className="text-sm text-text-secondary">{store.address}</p><p className="text-sm">{store.is_active ? "Active" : "Archived"}</p></div><div className="flex flex-wrap gap-3">{store.is_active && <Link className={buttonClass} href={`/merchant?outlet=${encodeURIComponent(store.slug)}`}>Manage store</Link>}<button disabled={busy} className={buttonClass} onClick={() => { if (store.is_active && !window.confirm(`Remove ${store.name} from active stores? Past orders will be retained.`)) return; void act({ action: store.is_active ? "archive_store" : "restore_store", outletId: store.id }); }}>{store.is_active ? "Remove store" : "Restore store"}</button></div></article>)}</section>
    <div className="grid md:grid-cols-2 gap-6">
      <form className="p-5 bg-surface-base border border-border-subtle rounded-md space-y-3" onSubmit={async event => { event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); if (await act({ ...data, action: "add_store", lat: Number(data.lat), lng: Number(data.lng) })) form.reset(); }}>
        <h2 className="text-xl font-bold">Add store</h2>{[["name", "Store name"], ["slug", "URL slug"], ["address", "Address"], ["area", "Area"], ["phone", "Store phone"], ["lat", "Latitude"], ["lng", "Longitude"]].map(([name, label]) => <label key={name} className="block text-sm font-bold">{label}<input className={inputClass} name={name} required type={name === "lat" || name === "lng" ? "number" : "text"} step="any" min={name === "lat" ? -90 : name === "lng" ? -180 : undefined} max={name === "lat" ? 90 : name === "lng" ? 180 : undefined} /></label>)}<p className="text-sm text-text-secondary">New stores start closed. Configure menu and hours before opening.</p><button disabled={busy} className={buttonClass}>Add store</button>
      </form>
      <form className="p-5 bg-surface-base border border-border-subtle rounded-md space-y-3" onSubmit={async event => { event.preventDefault(); const form = event.currentTarget; if (await act({ ...Object.fromEntries(new FormData(form)), action: "grant_access" })) form.reset(); }}>
        <h2 className="text-xl font-bold">Merchant access</h2><label className="block text-sm font-bold">Store<select name="outletId" required className={inputClass}><option value="">Choose store</option>{stores.filter(store => store.is_active).map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
        <label className="block text-sm font-bold">Merchant email<input name="email" type="email" required autoComplete="off" className={inputClass} /></label>
        <label className="block text-sm font-bold">Password for new account<input name="password" type="password" minLength={12} autoComplete="new-password" className={inputClass} /></label><p className="text-sm text-text-secondary">At least 12 characters. Leave blank for an existing account; its password stays the same.</p>
        <label className="block text-sm font-bold">Role<select name="role" className={inputClass}><option value="manager">Store manager</option><option value="staff">Kitchen staff</option></select></label><button disabled={busy} className={buttonClass}>Grant access</button>
      </form>
    </div>
    <section className="space-y-3"><h2 className="text-xl font-bold">Merchant accounts</h2>{merchants.length === 0 && <p>No merchant access assigned.</p>}{merchants.map(merchant => <article key={merchant.id} className="bg-surface-base border border-border-subtle rounded-md p-4 flex flex-wrap justify-between items-center gap-4"><div><h3 className="font-bold break-all">{merchant.email}</h3><p className="text-sm">{stores.find(store => store.id === merchant.outlet_id)?.name} · {merchant.role}</p></div><button disabled={busy} className={buttonClass} onClick={() => { if (window.confirm(`Revoke ${merchant.email}'s access to this store?`)) void act({ action: "revoke_access", membershipId: merchant.id }); }}>Revoke access</button></article>)}</section>
  </div></main>;
}
