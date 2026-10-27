const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('bearer identity is verified by Supabase and cookie refresh is isolated', async () => {
  for (const valid of [true, false]) {
    let options, verifiedToken;
    const scope = { exports: {}, process: { env: {} }, require: name => ({
      '@supabase/ssr': { createServerClient: (_, __, config) => {
        options = config;
        return { auth: { getUser: async token => {
          verifiedToken = token;
          return { data: { user: valid ? { id: 'staff' } : null }, error: valid ? null : { message: 'Invalid token' } };
        } } };
      } },
      'next/headers': { cookies: async () => ({ getAll: () => [{ name: 'old-session' }], set: () => {} }) },
      './client': { isSupabaseConfigured: () => true },
      ws: { default: class WebSocket {} },
    })[name] };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/supabase/server.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
    const user = await scope.exports.getVerifiedUser(new Request('https://example.test', { headers: { Authorization: 'Bearer test-token' } }));
    assert.equal(verifiedToken, 'test-token');
    assert.equal(options.global.headers.Authorization, 'Bearer test-token');
    assert.equal(options.cookies.getAll().length, 0);
    assert.equal(user?.id || null, valid ? 'staff' : null);
    await scope.exports.getSupabaseServerClient();
    assert.equal(options.cookies.getAll()[0].name, 'old-session');
  }
});
