// Store only the cooldown deadline, never session tokens.
export function createRefreshFetch(
  upstream: typeof fetch,
  storage?: Pick<Storage, "getItem" | "setItem">,
  now = Date.now
): typeof fetch {
  let blockedUntil = 0;
  const inFlight = new Map<unknown, Promise<Response>>();
  return async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (!url.pathname.endsWith("/auth/v1/token") || url.searchParams.get("grant_type") !== "refresh_token") {
      return upstream(input, init);
    }
    const key = `supabase-refresh-cooldown:${url.origin}`;
    try { blockedUntil = Math.max(blockedUntil, Number(storage?.getItem(key)) || 0); } catch { /* Storage may be unavailable. */ }
    if (blockedUntil > now()) {
      return new Response(JSON.stringify({ code: "over_request_rate_limit", msg: "Session refresh is temporarily rate limited. Please wait before retrying." }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((blockedUntil - now()) / 1000)) },
      });
    }
    // Only identical refresh bodies may share a response. Different sessions stay separate.
    const requestKey = typeof init?.body === "string" ? init.body : Symbol();
    let pending = inFlight.get(requestKey);
    if (!pending) {
      pending = (async () => {
        const response = await upstream(input, init);
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const seconds = retryAfter === null ? NaN : Number(retryAfter);
          const deadline = Number.isFinite(seconds) ? now() + seconds * 1000 : Date.parse(retryAfter || "");
          blockedUntil = Math.max(now() + 60000, Number.isFinite(deadline) ? deadline : 0);
          try { storage?.setItem(key, String(blockedUntil)); } catch { /* Keep the in-memory cooldown. */ }
        }
        return response;
      })();
      inFlight.set(requestKey, pending);
    }
    try { return (await pending).clone(); }
    finally { if (inFlight.get(requestKey) === pending) inFlight.delete(requestKey); }
  };
}
