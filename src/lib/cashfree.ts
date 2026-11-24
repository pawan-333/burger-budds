import { createHmac, timingSafeEqual } from "crypto";

export type CashfreeMode = "sandbox" | "production";

export function cashfreeConfig(requireEnabled = true) {
  const clientId = (process.env.CASHFREE_CLIENT_ID || "").trim();
  const secret = (process.env.CASHFREE_CLIENT_SECRET || "").trim();
  const mode = process.env.CASHFREE_ENV;
  const testKeys = clientId.startsWith("TEST") && secret.includes("_test_");
  const liveKeys = clientId.length >= 8 && secret.length >= 16 && !clientId.startsWith("TEST") && !secret.includes("_test_");
  if ((requireEnabled && process.env.CASHFREE_ENABLED !== "true") ||
      !((mode === "sandbox" && testKeys) || (mode === "production" && liveKeys))) {
    throw new Error("Cashfree is not configured for the selected environment.");
  }
  const previewOrigin = mode === "sandbox" && process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}` : "";
  const siteUrl = new URL(process.env.CASHFREE_SITE_URL || previewOrigin);
  const liveDomain = ["burgerbudds.in", "www.burgerbudds.in"].includes(siteUrl.hostname);
  if (mode === "sandbox" && liveDomain) {
    throw new Error("Sandbox payments require a separate test site.");
  }
  if (mode === "production" && (!liveDomain || siteUrl.protocol !== "https:")) throw new Error("Live payments require the approved HTTPS website.");
  if (siteUrl.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && siteUrl.protocol === "http:" && siteUrl.hostname === "localhost")) {
    throw new Error("Cashfree return URL must use HTTPS.");
  }
  return { clientId, secret, origin: siteUrl.origin, mode: mode as CashfreeMode,
    apiBase: mode === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg" };
}

export function cashfreeEnabled() {
  try { cashfreeConfig(); return true; } catch { return false; }
}

export interface CashfreeOrder {
  order_id: string;
  order_status: string;
  order_amount: number;
  order_currency: string;
  payment_session_id?: string;
}

export interface CashfreePayment {
  cf_payment_id: string | number;
  payment_status: string;
  payment_amount: number;
  payment_currency: string;
}

export async function cashfreeRequest<T>(endpoint: string, options?: { body: unknown; key: string }): Promise<T | null> {
  const config = cashfreeConfig(false);
  const response = await fetch(`${config.apiBase}${endpoint}`, {
    method: options ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json", "x-api-version": "2025-01-01",
      "x-client-id": config.clientId, "x-client-secret": config.secret,
      ...(options ? { "x-idempotency-key": options.key } : {}),
    },
    ...(options ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404 && !options) return null;
  // Provider error bodies may contain personal data; do not log or forward them.
  if (!response.ok) throw new Error("Cashfree is temporarily unavailable. Please retry.");
  return response.json();
}

export function validCashfreeSignature(raw: string, timestamp: string | null, signature: string | null) {
  if (!timestamp || !/^\d{10,16}$/.test(timestamp) || !signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const expected = createHmac("sha256", cashfreeConfig(false).secret).update(timestamp + raw).digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && timingSafeEqual(expected, received);
}

export function successfulCashfreePayment(order: CashfreeOrder, payments: CashfreePayment[], providerId: string, amount: number) {
  const cents = (value: number) => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : -1;
  if (order.order_id !== providerId || order.order_status !== "PAID" || order.order_currency !== "INR" || cents(order.order_amount) !== cents(amount)) return null;
  return payments.find((payment) => payment.payment_status === "SUCCESS" && payment.payment_currency === "INR" &&
    cents(payment.payment_amount) === cents(amount) &&
    (typeof payment.cf_payment_id !== "number" || Number.isSafeInteger(payment.cf_payment_id)) &&
    /^\d{1,40}$/.test(String(payment.cf_payment_id))) || null;
}
