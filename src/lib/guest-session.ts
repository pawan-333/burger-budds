import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";

// An opaque browser cookie scopes guest orders without collecting an email.
export async function getGuestOrderHash(create = false) {
  const jar = await cookies();
  let token = jar.get("bb_guest_orders")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    if (!create) return null;
    token = randomBytes(32).toString("hex");
    jar.set("bb_guest_orders", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return createHash("sha256").update(token).digest("hex");
}

export function publicOrder<T extends Record<string, unknown>>(order: T) {
  const { guest_session_hash: _private, ...visible } = order;
  return visible;
}
