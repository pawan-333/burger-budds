"use client";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { merchantLoginError } from "@/lib/merchant-access";

export function MerchantLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <main className="min-h-screen bg-surface-page flex items-center justify-center p-4">
    <form className="w-full max-w-md bg-surface-base rounded-md p-6 shadow-card space-y-4" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setMessage("");
      try {
        const client = getSupabaseBrowserClient();
        if (!client) { setMessage("Merchant login is not configured."); return; }
        const { error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) { setMessage(merchantLoginError(error)); return; }
        onSuccess();
      } catch { setMessage("Cannot connect to the login service. Check your connection and try again."); }
      finally { setBusy(false); }
    }}>
      <h1 className="text-2xl font-extrabold">Burger Budds Merchant</h1>
      <p className="text-sm text-text-secondary">Sign in with your store's merchant email and password to manage its orders.</p>
      <label className="block text-sm font-bold" htmlFor="merchant-email">Email address</label>
      <input id="merchant-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full min-h-[44px] border border-border-muted rounded-xs px-3" />
      <label className="block text-sm font-bold" htmlFor="merchant-password">Password</label>
      <input id="merchant-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full min-h-[44px] border border-border-muted rounded-xs px-3" />
      {message && <p role="alert" className="text-sm">{message}</p>}
      <button disabled={busy} className="w-full min-h-[44px] rounded-xs bg-brand-primary text-text-onPrimary font-bold disabled:opacity-50">{busy ? "Please wait…" : "Sign in"}</button>
    </form>
  </main>;
}
