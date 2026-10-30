"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bike, Check, CheckCircle2, Clock3, LogOut, MapPin, Navigation, PackageCheck, Phone, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { riderLoginIdentity } from "@/lib/rider-login";
import type { RiderDashboardData, RiderDelivery } from "@/types/database";

const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
const buttonClass = "min-h-[48px] rounded-md px-4 font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary disabled:cursor-not-allowed disabled:opacity-50";

function destination(order: RiderDelivery) {
  const a = order.address;
  if (!a) return null;
  const query = typeof a.lat === "number" && typeof a.lng === "number" && Number.isFinite(a.lat) && Number.isFinite(a.lng) && Math.abs(a.lat) <= 90 && Math.abs(a.lng) <= 180
    ? `${a.lat},${a.lng}` : [a.house, a.landmark, a.locality, a.city].filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}` : null;
}

export default function RiderPage() {
  const [userId, setUserId] = useState<string | null>();
  const [data, setData] = useState<RiderDashboardData | null>(null);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(true);
  const [tab, setTab] = useState<"active" | "history">("active");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const fetching = useRef(false);
  const saving = useRef(false);
  const pollAllowed = useRef(true);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) { setUserId(null); setError("Rider sign-in is not configured. Contact your store."); return; }
    let currentUser: string | null | undefined;
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user.id || null;
      if (nextUser !== currentUser) {
        currentUser = nextUser;
        revision.current++;
        request.current?.abort();
        fetching.current = false;
        saving.current = false;
        pollAllowed.current = true;
        setData(null); setError(""); setActionMessage(""); setConfirmId(null); setPendingId(null);
        setUserId(nextUser);
      }
    });
    return () => { revision.current++; request.current?.abort(); listener.subscription.unsubscribe(); };
  }, []);

  const load = useCallback(async () => {
    if (!userId || fetching.current || saving.current || !navigator.onLine) return;
    fetching.current = true;
    const ticket = ++revision.current;
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    try {
      const session = await getSupabaseBrowserClient()?.auth.getSession();
      if (ticket !== revision.current) return;
      const token = session?.data.session?.access_token;
      if (!token || session?.error) throw new Error("Session unavailable. Sign in again or retry in a minute.");
      const response = await fetch("/api/rider/orders", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (ticket !== revision.current) return;
      if (!response.ok) {
        if ([401, 403, 429, 503].includes(response.status)) pollAllowed.current = false;
        throw new Error(body.error || "Could not load deliveries.");
      }
      setData(body); setError(""); pollAllowed.current = true;
    } catch (err) {
      if (ticket === revision.current) {
        setData(null);
        setError(err instanceof Error && err.name !== "AbortError" ? err.message : "Connection interrupted. Please retry.");
      }
    } finally {
      window.clearTimeout(timeout);
      if (ticket === revision.current) { fetching.current = false; setLoading(false); }
    }
  }, [userId]);

  useEffect(() => {
    const connection = () => { setOnline(navigator.onLine); if (navigator.onLine && pollAllowed.current) void load(); };
    const visible = () => { if (!document.hidden && pollAllowed.current) void load(); };
    connection();
    const timer = window.setInterval(visible, 15000);
    window.addEventListener("online", connection); window.addEventListener("offline", connection);
    document.addEventListener("visibilitychange", visible);
    return () => {
      revision.current++; request.current?.abort(); fetching.current = false;
      window.clearInterval(timer);
      window.removeEventListener("online", connection); window.removeEventListener("offline", connection);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (signingIn) return;
    setSigningIn(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("Rider sign-in is not configured. Contact your store.");
      const identity = riderLoginIdentity(mobile);
      if (!identity || !/^\d{6}$/.test(password)) throw new Error("Enter your mobile number and 6-digit PIN.");
      const result = await client.auth.signInWithPassword({ email: identity.email, password });
      if (result.error) throw new Error(result.error.status === 429 ? "Too many attempts. Wait a minute before retrying." : "Could not sign in. Check your mobile number and PIN.");
      setPassword("");
    } catch (err) { setError(err instanceof Error ? err.message : "Sign-in unavailable. Please retry."); }
    finally { setSigningIn(false); }
  }

  async function signOut() {
    revision.current++; request.current?.abort(); setData(null); setConfirmId(null);
    try {
      const result = await getSupabaseBrowserClient()?.auth.signOut({ scope: "local" });
      if (result?.error) throw new Error("Sign-out failed. Please retry.");
      setUserId(null); setError("");
    } catch { setError("Could not sign out. Please retry."); }
  }

  async function complete(order: RiderDelivery) {
    if (saving.current || !navigator.onLine) return;
    request.current?.abort(); fetching.current = false;
    const ticket = ++revision.current;
    saving.current = true; setPendingId(order.id); setLoading(false); setActionMessage("");
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const session = await getSupabaseBrowserClient()?.auth.getSession();
      if (ticket !== revision.current) return;
      const token = session?.data.session?.access_token;
      if (!token || session?.error) throw new Error("Session unavailable. Sign in again before confirming delivery.");
      const response = await fetch(`/api/rider/orders/${encodeURIComponent(order.id)}/complete`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      });
      const body = await response.json();
      if (ticket !== revision.current) return;
      if (!response.ok) throw new Error(body.error || "Could not confirm delivery. Refresh before retrying.");
      setActionMessage(`Order ${order.order_no} delivered. Thank you!`);
    } catch (err) {
      if (ticket === revision.current) setActionMessage(err instanceof Error && err.name !== "AbortError" ? err.message : "Connection interrupted. Refresh to check delivery status before retrying.");
    } finally {
      window.clearTimeout(timeout);
      if (ticket === revision.current) {
        saving.current = false; setPendingId(null); setConfirmId(null); void load();
      }
    }
  }

  return <main className="min-h-screen bg-surface-page pb-10 text-text-primary">
    <header className="bg-brand-secondary text-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-5">
        <Link href="/" aria-label="Burger Budds home" className="flex items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-primary text-brand-secondaryDark"><Bike aria-hidden="true" size={25} /></span>
          <span><span className="block text-lg font-extrabold leading-tight">Burger Budds</span><span className="text-xs font-medium tracking-widest text-white/80">RIDER</span></span>
        </Link>
        {userId && <button onClick={() => void signOut()} disabled={!!pendingId} className={`${buttonClass} flex items-center gap-2 border border-white/30 text-sm`}><LogOut size={16} aria-hidden="true" />Sign out</button>}
      </div>
    </header>
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      {!online && <p role="alert" className="mt-5 flex gap-2 rounded-md bg-status-warningSoft p-4 text-sm"><WifiOff size={20} aria-hidden="true" />You’re offline. Reconnect to refresh orders or confirm delivery.</p>}
      {userId === undefined ? <p role="status" className="py-16 text-center text-text-muted">Checking your session…</p> : !userId ?
        <section className="mx-auto mt-10 max-w-md rounded-2xl border border-border-subtle bg-white p-6 shadow-card sm:p-8">
          <span className="inline-flex rounded-pill bg-brand-secondarySoft px-3 py-1 text-xs font-bold text-brand-secondary">DELIVER WITH BURGER BUDDS</span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Your next delivery<br />starts here.</h1>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">Use your registered mobile number and the private 6-digit PIN set by your store.</p>
          <form onSubmit={signIn} className="mt-7 space-y-4">
            <div><label htmlFor="rider-mobile" className="mb-2 block text-sm font-bold">Mobile number</label><input id="rider-mobile" type="tel" inputMode="tel" autoComplete="username" required maxLength={18} value={mobile} onChange={e => setMobile(e.target.value)} className="min-h-[48px] w-full rounded-md border border-border-muted px-3 focus:outline-brand-secondary" /></div>
            <div><label htmlFor="rider-password" className="mb-2 block text-sm font-bold">6-digit PIN</label><input id="rider-password" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="min-h-[48px] w-full rounded-md border border-border-muted px-3 focus:outline-brand-secondary" /></div>
            {error && <p role="alert" className="rounded-md bg-status-errorSoft p-3 text-sm text-status-error">{error}</p>}
            <button disabled={signingIn || !online} className={`${buttonClass} flex w-full items-center justify-center gap-2 bg-brand-primary text-text-onPrimary`}>{signingIn ? "Signing in…" : "Sign in"}<ArrowRight size={18} aria-hidden="true" /></button>
          </form>
          <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-text-muted"><ShieldCheck size={18} className="shrink-0 text-brand-secondary" aria-hidden="true" />Need an account or PIN reset? Contact your store manager. Never share your PIN.</p>
        </section> : <>
          <div className="flex items-start justify-between gap-3 pb-6 pt-8">
            <div><p className="text-sm font-bold text-brand-secondary">{data?.rider.outlet_name || "Rider workspace"}</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight">{data ? `Hi, ${data.rider.name.split(" ")[0]}` : "Your deliveries"}</h1><p className="mt-2 text-sm text-text-muted">One order at a time. Delivered with care.</p></div>
            <button aria-label="Refresh deliveries" title="Refresh deliveries" onClick={() => { pollAllowed.current = true; void load(); }} disabled={loading || !!pendingId || !online} className={`${buttonClass} border border-border-muted bg-white`}><RefreshCw size={19} className={loading ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" /></button>
          </div>
          {error && <div role="alert" className="mb-5 rounded-md border border-status-error/20 bg-status-errorSoft p-4 text-sm text-status-error">{error}<button onClick={() => { pollAllowed.current = true; void load(); }} disabled={loading || !online} className="ml-2 min-h-[44px] px-2 font-bold underline">Retry</button></div>}
          {actionMessage && <p role="status" className="mb-5 rounded-md border border-border-muted bg-white p-4 text-sm">{actionMessage}</p>}
          {!data && loading && <div role="status" className="rounded-2xl bg-white p-10 text-center text-text-muted">Loading your deliveries…</div>}
          {data && <>
            <div className="mb-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-brand-secondary p-5 text-white"><Bike size={22} className="text-brand-primary" aria-hidden="true" /><p className="mt-3 text-3xl font-extrabold">{data.active.length}{data.active_limit_reached ? "+" : ""}</p><p className="mt-1 text-sm text-white/80">Active deliveries</p></div>
              <div className="rounded-2xl border border-border-subtle bg-white p-5"><PackageCheck size={22} className="text-brand-secondary" aria-hidden="true" /><p className="mt-3 text-3xl font-extrabold">{money(data.active.reduce((sum, order) => sum + order.cod_due, 0))}</p><p className="mt-1 text-sm text-text-muted">Cash to collect</p></div>
            </div>
            <div className="mb-5 flex gap-2 border-b border-border-muted" aria-label="Delivery views">
              {([['active', 'Active orders'], ['history', 'Recent deliveries']] as const).map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)} className={`min-h-[48px] border-b-2 px-3 text-sm font-bold ${tab === key ? "border-brand-secondary text-brand-secondary" : "border-transparent text-text-muted"}`}>{label}</button>)}
            </div>
            {tab === "active" ? <div className="space-y-4">
              {data.active_limit_reached && <p className="text-sm text-text-muted">Showing the first 100 assignments. Complete and refresh to see more.</p>}
              {!data.active.length && <div className="rounded-2xl border border-border-subtle bg-white px-6 py-12 text-center"><CheckCircle2 size={36} className="mx-auto text-brand-secondary" aria-hidden="true" /><h2 className="mt-4 text-lg font-extrabold">You’re all caught up</h2><p className="mx-auto mt-2 max-w-xs text-sm text-text-muted">Orders appear here when your store hands them over to your registered rider account.</p></div>}
              {data.active.map(order => {
                const map = destination(order);
                const phone = order.customer_phone.replace(/[\s()-]/g, "");
                const canCall = /^\+?[0-9]{10,15}$/.test(phone);
                return <article key={order.id} className="overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-5 py-4"><h2 className="font-extrabold">#{order.order_no}</h2><span className="rounded-pill bg-brand-secondarySoft px-3 py-1 text-xs font-bold text-brand-secondary">Out for delivery</span></div>
                  <div className="space-y-5 p-5">
                    <div><p className="text-lg font-extrabold">{order.customer_name || "Customer"}</p><div className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-text-secondary"><MapPin size={18} className="mt-0.5 shrink-0 text-brand-secondary" aria-hidden="true" /><p>{order.address ? [order.address.house, order.address.landmark, order.address.locality, order.address.city].filter(Boolean).join(", ") : "Address unavailable. Contact your store."}</p></div></div>
                    <ul className="space-y-1 text-sm text-text-muted">{order.items.map((item, index) => <li key={index}><span className="font-bold text-text-secondary">{item.qty}×</span> {item.name}{item.variant ? ` · ${item.variant}` : ""}</li>)}</ul>
                    {order.instructions && <p className="rounded-md bg-surface-raised p-3 text-sm"><strong>Delivery note: </strong>{order.instructions}</p>}
                    <div className={`flex items-center justify-between gap-3 rounded-md p-3 ${order.cod_due > 0 ? "bg-brand-primarySoft" : "bg-brand-secondarySoft"}`}><span className="text-sm font-bold">{order.payment_label}</span><span className="font-extrabold">{order.cod_due > 0 ? money(order.cod_due) : <Check size={20} aria-label="No cash due" />}</span></div>
                    <div className="grid grid-cols-2 gap-3">
                      {canCall ? <a href={`tel:${phone}`} className={`${buttonClass} flex items-center justify-center gap-2 border border-border-muted`}><Phone size={17} aria-hidden="true" />Call customer</a> : <span className="py-3 text-sm text-text-muted">Phone unavailable</span>}
                      {map ? <a href={map} target="_blank" rel="noopener noreferrer" className={`${buttonClass} flex items-center justify-center gap-2 border border-border-muted`}><Navigation size={17} aria-hidden="true" />Navigate</a> : <span className="py-3 text-sm text-text-muted">Map unavailable</span>}
                    </div>
                    {confirmId === order.id ? <div className="rounded-md border border-brand-secondary/30 bg-brand-secondarySoft p-4"><p className="text-sm font-bold">Have you handed this order to the customer?</p><p className="mt-1 text-xs text-text-muted">This confirms delivery only. Payment records are not changed.</p><div className="mt-3 flex gap-2"><button onClick={() => void complete(order)} disabled={!!pendingId || !online || loading} className={`${buttonClass} flex-1 bg-brand-secondary text-white`}>{pendingId === order.id ? "Saving…" : "Confirm delivered"}</button><button onClick={() => setConfirmId(null)} disabled={!!pendingId} className={`${buttonClass} border border-border-muted bg-white`}>Go back</button></div></div> : <button onClick={() => setConfirmId(order.id)} disabled={!!pendingId || !online || loading} className={`${buttonClass} flex w-full items-center justify-center gap-2 bg-brand-secondary text-white`}><PackageCheck size={19} aria-hidden="true" />Mark delivered</button>}
                  </div>
                </article>;
              })}
            </div> : <section className="rounded-2xl border border-border-subtle bg-white p-5">
              <h2 className="font-extrabold">Your recent deliveries</h2><p className="mt-1 text-xs text-text-muted">Latest 20 from the past 7 days. Customer contact details are hidden after delivery.</p>
              {!data.history.length ? <p className="py-10 text-center text-sm text-text-muted">Completed deliveries will appear here.</p> : <ul className="mt-4 divide-y divide-border-subtle">{data.history.map(order => <li key={order.id} className="flex items-center gap-3 py-4"><CheckCircle2 size={21} className="text-brand-secondary" aria-hidden="true" /><div><p className="font-bold">#{order.order_no}</p><p className="mt-1 flex items-center gap-1 text-xs text-text-muted"><Clock3 size={12} aria-hidden="true" />{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(order.delivered_at))}</p></div><span className="ml-auto text-xs font-bold text-brand-secondary">Delivered</span></li>)}</ul>}
            </section>}
            <p className="mt-6 text-center text-xs text-text-muted">Refreshes every 15 seconds while this page is visible.</p>
          </>}
        </>}
    </div>
  </main>;
}
