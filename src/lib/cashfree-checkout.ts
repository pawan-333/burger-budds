interface CashfreeBrowserClient {
  checkout(options: { paymentSessionId: string; redirectTarget: "_self" }): Promise<{ error?: { message?: string } }>;
}
declare global {
  interface Window { Cashfree?: (options: { mode: "sandbox" | "production" }) => CashfreeBrowserClient; }
}

let sdkPromise: Promise<void> | null = null;
function loadCashfreeSdk() {
  if (window.Cashfree) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    const timeout = window.setTimeout(() => fail(), 20000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove(); sdkPromise = null;
      reject(new Error("Payment checkout could not load. Check your connection and retry."));
    }
    script.onload = () => { window.clearTimeout(timeout); if (window.Cashfree) resolve(); else fail(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export async function openCashfreeCheckout(orderId: string) {
  const response = await fetch("/api/payments/cashfree", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Payment checkout is unavailable.");
  await loadCashfreeSdk();
  if (!window.Cashfree || !["sandbox", "production"].includes(data.mode)) throw new Error("Payment mode mismatch.");
  const result = await window.Cashfree({ mode: data.mode }).checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: "_self" });
  if (result?.error) throw new Error("Payment was not completed. Refresh payment status before retrying.");
}
