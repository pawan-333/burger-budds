import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "./client";
import WebSocket from "ws";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";

export async function getSupabaseServerClient(request?: Request) {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  const authorization = request?.headers.get("authorization");
  const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
      realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
      cookies: {
        getAll: () => token ? [] : cookieStore.getAll(),
        setAll: (values: { name: string; value: string; options: CookieOptions }[]) => {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
}

export async function getVerifiedUser(request?: Request) {
  const sb = await getSupabaseServerClient(request);
  if (!sb) return null;
  const token = request?.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  const { data, error } = await sb.auth.getUser(token);
  return error ? null : data.user;
}
