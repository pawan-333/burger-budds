"use client";
import { useState } from "react";
import { sendEmailOtp, verifyEmailOtp } from "@/lib/supabase/email-auth";

export function MerchantLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <main className="min-h-screen bg-surface-page flex items-center justify-center p-4">
    <form className="w-full max-w-md bg-surface-base rounded-md p-6 shadow-card space-y-4" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setMessage("");
      try {
        const result = sent ? await verifyEmailOtp(email, code) : await sendEmailOtp(email);
        if (!result.ok) { setMessage(result.message); return; }
        if (sent) onSuccess(); else { setSent(true); setMessage(result.message); }
      } catch { setMessage("Unable to sign in. Please try again."); }
      finally { setBusy(false); }
    }}>
      <h1 className="text-2xl font-extrabold">Burger Budds Merchant</h1>
      <p className="text-sm text-text-secondary">Sign in with your authorised staff email to manage orders.</p>
      <label className="block text-sm font-bold" htmlFor="merchant-email">Email address</label>
      <input id="merchant-email" type="email" autoComplete="email" required value={email} disabled={sent} onChange={(event) => setEmail(event.target.value)} className="w-full min-h-[44px] border border-border-muted rounded-xs px-3" />
      {sent && <><label className="block text-sm font-bold" htmlFor="merchant-code">Verification code</label>
        <input id="merchant-code" autoComplete="one-time-code" inputMode="numeric" required maxLength={8} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="w-full min-h-[44px] border border-border-muted rounded-xs px-3" /></>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <button disabled={busy} className="w-full min-h-[44px] rounded-xs bg-brand-primary text-text-onPrimary font-bold disabled:opacity-50">{busy ? "Please wait…" : sent ? "Verify and sign in" : "Send login code"}</button>
      {sent && <button type="button" onClick={() => { setSent(false); setCode(""); }} className="min-h-[44px] text-brand-secondary underline">Use another email</button>}
    </form>
  </main>;
}
