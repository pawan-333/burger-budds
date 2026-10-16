// Apply the approved PDF catalog only to Badagaon. Run without --apply to preview.
// Replaced records are archived, never deleted, preserving order references.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
require('@next/env').loadEnvConfig(process.cwd());
const catalog = require('../src/lib/data/badagaon-menu.json');
const slug = 'burger-budds-badagaon-gwalior';
const expectedProject = 'fyhkxqygoqmllxjfybyt.supabase.co';
const apply = process.argv.includes('--apply');

async function checked(request) {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert.equal(new URL(url).hostname, expectedProject, 'Wrong Supabase project');
  assert(process.env.SUPABASE_SERVICE_ROLE_KEY, 'Missing service key');
  const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, realtime: { transport: require('ws') } });
  const outlet = await checked(sb.from('outlets').select('id,slug').eq('slug', slug).single());
  const categories = catalog.categories.map(row => ({ ...row, outlet_id: outlet.id }));
  const items = catalog.items.map(({ variants, addon_groups, ...row }) => ({ ...row, outlet_id: outlet.id }));
  const variants = catalog.items.flatMap(row => row.variants);
  assert.equal(items.length, 83);
  assert.equal(categories.length, 16);
  assert.equal(variants.length, 38);
  const oldCategories = await checked(sb.from('categories').select('*').eq('outlet_id', outlet.id));
  const oldItems = await checked(sb.from('items').select('*, variants:item_variants(*), addon_groups(*, addons(*))').eq('outlet_id', outlet.id));
  const categoryIds = new Set(categories.map(row => row.id));
  const itemIds = new Set(items.map(row => row.id));
  const retiredCategories = oldCategories.filter(row => !categoryIds.has(row.id));
  const retiredItems = oldItems.filter(row => !itemIds.has(row.id));
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', outlet: slug, categories: categories.length, items: items.length, variants: variants.length, archiveItems: retiredItems.length }));
  if (!apply) return;
  const backupDir = path.join(process.cwd(), '.data', 'menu-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `badagaon-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ outlet, categories: oldCategories, items: oldItems }, null, 2));
  // Stage categories hidden and items unavailable. Publish only after all rows
  // and price variants have been written and checked.
  await checked(sb.from('categories').upsert(categories.map(row => ({ ...row, is_active: false }))));
  await checked(sb.from('items').upsert(items.map(row => ({ ...row, is_available: false }))));
  await checked(sb.from('item_variants').upsert(variants));
  const storedItems = await checked(sb.from('items').select('id,price,variants:item_variants(id,price_delta)').eq('outlet_id', outlet.id).in('id', [...itemIds]));
  assert.equal(storedItems.length, items.length);
  for (const item of catalog.items) {
    const saved = storedItems.find(row => row.id === item.id);
    assert.equal(Number(saved.price), item.price);
    assert.equal(saved.variants.length, item.variants.length);
    for (const variant of item.variants) assert.equal(Number(saved.variants.find(row => row.id === variant.id)?.price_delta), variant.price_delta);
  }
  await checked(sb.from('items').update({ is_available: true }).eq('outlet_id', outlet.id).in('id', [...itemIds]));
  await checked(sb.from('categories').update({ is_active: true }).eq('outlet_id', outlet.id).in('id', [...categoryIds]));
  if (retiredItems.length) await checked(sb.from('items').update({ is_available: false }).eq('outlet_id', outlet.id).in('id', retiredItems.map(row => row.id)));
  if (retiredCategories.length) await checked(sb.from('categories').update({ is_active: false }).eq('outlet_id', outlet.id).in('id', retiredCategories.map(row => row.id)));
  console.log('Menu saved and all prices/variants verified. Backup: ' + backupPath);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
