// Run after migration 006. Password is supplied privately through the environment.
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const emails = ['vinaynagar@burgerbudds.in', 'badagaon@burgerbudds.in'];
async function main() {
  const email = process.argv[2];
  const password = process.env.MERCHANT_PASSWORD;
  if (!emails.includes(email) || !password || password.length < 12) {
    throw new Error('Provide an approved store email and MERCHANT_PASSWORD of at least 12 characters.');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server environment is required.');
  const client = createClient(url, key, { auth: { persistSession: false }, realtime: { transport: WebSocket } });
  const { error } = await client.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { store_merchant: true },
  });
  if (error) throw new Error(error.message);
  console.log(`Created merchant account for ${email}.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
