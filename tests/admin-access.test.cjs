const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(user, admin) {
  let mutations = 0;
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: admin ? { user_id: user.id } : null }) };
  const client = { from: () => query, auth: { admin: { createUser: async () => { mutations++; } } } };
  const modules = {
    'next/server': { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } },
    '@/lib/supabase/server': { getVerifiedUser: async () => user },
    '@/lib/server-db': { getSupabaseAdminClient: () => client },
  };
  const scope = { exports: {}, require: name => modules[name], console };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/admin/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
  return { route: scope.exports, mutations: () => mutations };
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
