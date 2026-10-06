const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const scope = { exports: {}, require: () => ({}) };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/merchant-access.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
function client({ archived = false, member = true, legacy = false } = {}) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'merchant' } }, error: null }) },
    from(table) {
      let selection = '';
      const query = {
        select: value => { selection = value; return query; }, eq: () => query, order: () => query, limit: () => query,
        maybeSingle: async () => {
          if (table === 'super_admins') return legacy ? { data: null, error: { code: 'PGRST205' } } : { data: null, error: null };
          if (table === 'staff') return { data: member ? { role: 'manager', outlet_id: 'store' } : null, error: null };
          if (legacy && selection.includes('is_active')) return { data: null, error: { code: '42703', message: 'column outlets.is_active does not exist' } };
          return { data: { slug: 'store', ...(legacy ? {} : { is_active: !archived }) }, error: null };
        },
      };
      return query;
    },
  };
}
test('existing staff can sign in before archive migration', async () => {
  const result = await scope.exports.verifyMerchantAccess(client({ legacy: true }), null);
  assert.equal(result.status, 'allowed'); assert.equal(result.role, 'manager');
});
test('login does not grant access without assigned membership', async () => {
  const result = await scope.exports.verifyMerchantAccess(client({ member: false }), null);
  assert.equal(result.status, 'denied'); assert.match(result.message, /no store access/i);
});
test('archived store cannot be accessed', async () => {
  assert.equal((await scope.exports.verifyMerchantAccess(client({ archived: true }), null)).status, 'denied');
});
test('network login errors are distinguished from invalid credentials', () => {
  assert.match(scope.exports.merchantLoginError({ message: 'Failed to fetch' }), /connect/);
  assert.match(scope.exports.merchantLoginError({ code: 'invalid_credentials' }), /account must be created/);
});
