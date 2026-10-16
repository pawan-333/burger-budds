// Update images only; preserve live prices, stock and customizations.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
require('@next/env').loadEnvConfig(process.cwd());
const catalog = require('../src/lib/data/badagaon-menu.json');
async function checked(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert.equal(new URL(url).hostname, 'fyhkxqygoqmllxjfybyt.supabase.co');
  assert(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, realtime: { transport: require('ws') } });
  const outlet = await checked(sb.from('outlets').select('id').eq('slug', 'burger-budds-badagaon-gwalior').single());
  const ids = catalog.items.map(item => item.id);
  const before = await checked(sb.from('items').select('id,image_url,price,is_available').eq('outlet_id', outlet.id).in('id', ids));
  assert.equal(before.length, 83);
  // Validate every distinct remote image before making any database changes.
  const urls = [...new Set(catalog.items.map(item => item.image_url))];
  for (const imageUrl of urls) {
    const result = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(20000) });
    assert(result.ok && result.headers.get('content-type')?.startsWith('image/'), 'Invalid image: ' + imageUrl);
  }
  console.log(`${before.length} items and ${urls.length} stock photos verified.`);
  if (!process.argv.includes('--apply')) return;
  fs.mkdirSync('.data/menu-backups', { recursive: true });
  fs.writeFileSync(`.data/menu-backups/badagaon-images-${Date.now()}.json`, JSON.stringify(before, null, 2));
  for (const imageUrl of urls) {
    const groupIds = catalog.items.filter(item => item.image_url === imageUrl).map(item => item.id);
    await checked(sb.from('items').update({ image_url: imageUrl }).eq('outlet_id', outlet.id).in('id', groupIds));
  }
  const after = await checked(sb.from('items').select('id,image_url,price,is_available').eq('outlet_id', outlet.id).in('id', ids));
  assert.equal(after.length, before.length);
  for (const item of after) {
    const original = before.find(row => row.id === item.id);
    assert.equal(item.image_url, catalog.items.find(row => row.id === item.id).image_url);
    assert.equal(item.price, original.price);
    assert.equal(item.is_available, original.is_available);
  }
  console.log('All 83 live images updated; prices and stock preserved.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
