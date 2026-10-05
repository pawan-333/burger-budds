import { getSupabaseBrowserClient } from "./client";

export async function sendEmailOtp(email: string, name?: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return { ok: false, message: "Login is not configured. Please contact the store." };
  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { data: { name: name?.trim() || "" } },
  });
  if (error) {
    const emailLimitReached = error.code === "over_email_send_rate_limit" || /email rate limit/i.test(error.message);
    const requestLimitReached = error.status === 429;
    return {
      ok: false,
      message: emailLimitReached
        ? "Email sending is temporarily unavailable. If a code already arrived, use it; otherwise try again later."
        : requestLimitReached
          ? "Too many login requests. Please wait before requesting another code."
          : error.message,
    };
  }
  return { ok: true, message: "Check your email for the verification code." };
}

export async function verifyEmailOtp(email: string, token: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return { ok: false, message: "Login is not configured.", user: null };
  const { data, error } = await client.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: "email" });
  return { ok: !error && !!data.user, message: error?.message || "Signed in!", user: data.user };
}
