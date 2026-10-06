const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
async function main() {
  const password = process.env.MERCHANT_PASSWORD;
  if (!password || password.length < 12) throw new Error('Set MERCHANT_PASSWORD to your chosen password of at least 12 characters.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server environment is required.');
  const client = createClient(url, key, { auth: { persistSession: false }, realtime: { transport: WebSocket } });
  const email = 'admin@burgerbudds.in';
  let user = null;
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    user = data.users.find(account => account.email?.toLowerCase() === email);
    if (user || data.users.length < 100) break;
  }
  if (!user) {
    const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    user = data.user;
  }
  const { error } = await client.from('super_admins').upsert({ user_id: user.id });
  if (error) throw error;
  console.log('Super admin provisioned: admin@burgerbudds.in. Existing account passwords are unchanged.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
