const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(user, admin, storeExists = true) {
  let mutations = 0;
  let updated = null;
  const query = { select: () => query, eq: () => query, update: fields => { mutations++; updated = fields; return query; }, maybeSingle: async () => ({ data: updated ? (storeExists ? { id: 'store' } : null) : admin ? { user_id: user.id } : null }) };
  const client = { from: () => query, auth: { admin: { createUser: async () => { mutations++; } } } };
  const modules = {
    'next/server': { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } },
    '@/lib/supabase/server': { getVerifiedUser: async () => user },
    '@/lib/server-db': { getSupabaseAdminClient: () => client },
  };
  const scope = { exports: {}, require: name => modules[name], console };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/admin/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
  return { route: scope.exports, mutations: () => mutations, updated: () => updated };
}
for (const [label, user] of [['anonymous', null], ['store merchant', { id: 'store-user' }]]) {
  test(`${label} cannot read admin accounts or grant access`, async () => {
    const { route, mutations } = load(user, false);
    assert.equal((await route.GET()).status, 403);
    assert.equal((await route.POST({ json: async () => ({ action: 'grant_access' }) })).status, 403);
    assert.equal(mutations(), 0);
  });
}
test('super admin passes authorization but invalid action is rejected', async () => {
  const { route } = load({ id: 'admin' }, true);
  assert.equal((await route.POST({ json: async () => ({ action: 'unknown' }) })).status, 400);
});

test('only super admins can update delivery radius', async () => {
  for (const user of [null, { id: 'merchant' }]) {
    const { route, mutations } = load(user, false);
    assert.equal((await route.POST({ json: async () => ({ action: 'update_radius', outletId: 'store', radiusKm: 8 }) })).status, 403);
    assert.equal(mutations(), 0);
  }
});

test('radius updates reject invalid values without mutating stores', async () => {
  for (const radiusKm of [0, -1, 0.09, 101, NaN, Infinity, '5', null]) {
    const { route, mutations } = load({ id: 'admin' }, true);
    assert.equal((await route.POST({ json: async () => ({ action: 'update_radius', outletId: 'store', radiusKm }) })).status, 400);
    assert.equal(mutations(), 0);
  }
});

test('radius updates save valid bounds and leave other store settings untouched', async () => {
  for (const radiusKm of [0.1, 7.5, 100]) {
    const { route, updated } = load({ id: 'admin' }, true);
    assert.equal((await route.POST({ json: async () => ({ action: 'update_radius', outletId: 'store', radiusKm }) })).status, 200);
    assert.equal(JSON.stringify(updated()), JSON.stringify({ delivery_radius_km: radiusKm }));
  }
});

test('radius updates report missing stores', async () => {
  const { route } = load({ id: 'admin' }, true, false);
  assert.equal((await route.POST({ json: async () => ({ action: 'update_radius', outletId: 'missing', radiusKm: 5 }) })).status, 400);
});
