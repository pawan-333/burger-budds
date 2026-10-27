const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const scope = { exports: {}, URL, Response, Date };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/supabase/refresh-fetch.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
const { createRefreshFetch } = scope.exports;
const url = 'https://project.supabase.co/auth/v1/token?grant_type=refresh_token';
const init = { method: 'POST', body: 'test-session' };

test('identical concurrent refreshes share one network request with independently readable responses', async () => {
  let calls = 0, finish;
  const guarded = createRefreshFetch(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const first = guarded(url, init), second = guarded(url, init);
  assert.equal(calls, 1);
  finish(new Response('{"ok":true}'));
  assert.deepEqual(await (await first).json(), { ok: true });
  assert.deepEqual(await (await second).json(), { ok: true });
});

test('different session refreshes never share responses', async () => {
  let calls = 0;
  const guarded = createRefreshFetch(async (_, options) => { calls++; return new Response(options.body); });
  const responses = await Promise.all([guarded(url, init), guarded(url, { ...init, body: 'other-session' })]);
  assert.equal(calls, 2);
  assert.equal(await responses[0].text(), 'test-session');
  assert.equal(await responses[1].text(), 'other-session');
});

test('429 cooldown is shared between tabs, honors Retry-After and recovers', async () => {
  let time = 1000, calls = 0;
  const stored = new Map();
  const storage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) };
  const upstream = async () => { calls++; return calls === 1 ? new Response('{}', { status: 429, headers: { 'Retry-After': '120' } }) : new Response('{}'); };
  const firstTab = createRefreshFetch(upstream, storage, () => time);
  const secondTab = createRefreshFetch(upstream, storage, () => time);
  assert.equal((await firstTab(url, init)).status, 429);
  time += 61000;
  assert.equal((await secondTab(url, init)).status, 429);
  assert.equal(calls, 1);
  assert.equal([...stored.values()][0], '121000');
  time = 121001;
  assert.equal((await secondTab(url, init)).status, 200);
  assert.equal(calls, 2);
});

test('missing retry header uses bounded cooldown even when storage throws; other requests pass through', async () => {
  let calls = 0, time = 1000;
  const guarded = createRefreshFetch(async () => { calls++; return new Response('{}', { status: 429 }); }, { getItem: () => { throw Error(); }, setItem: () => { throw Error(); } }, () => time);
  await guarded(url, init); await guarded(url, init);
  assert.equal(calls, 1);
  await guarded('https://project.supabase.co/rest/v1/orders');
  assert.equal(calls, 2);
  time += 60001; await guarded(url, init);
  assert.equal(calls, 3);
});

test('network failure releases the in-flight request for recovery', async () => {
  let calls = 0;
  const guarded = createRefreshFetch(async () => { if (++calls === 1) throw Error('offline'); return new Response('{}'); });
  await assert.rejects(guarded(url, init), /offline/);
  assert.equal((await guarded(url, init)).status, 200);
});

test('auth event handling skips redundant refresh lookups and preserves sign-out updates', () => {
  const source = fs.readFileSync('src/context/AppContext.tsx', 'utf8');
  const start = source.indexOf('const { data: subscription } = sb.auth.onAuthStateChange');
  const end = source.indexOf('return () =>', start);
  let callback;
  const updates = [];
  const eventScope = { sb: { auth: { onAuthStateChange: fn => { callback = fn; return { data: {} }; } } }, active: true, syncUser: user => updates.push(user), setTimeout: fn => fn() };
  vm.runInNewContext(ts.transpileModule(source.slice(start, end), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, eventScope);
  callback('INITIAL_SESSION', { user: { id: 'staff' } });
  callback('TOKEN_REFRESHED', { user: { id: 'staff' } });
  assert.equal(updates.length, 0);
  callback('SIGNED_IN', { user: { id: 'staff' } });
  callback('SIGNED_OUT', null);
  assert.equal(updates[0].id, 'staff'); assert.equal(updates[1], null);
  eventScope.active = false; callback('SIGNED_IN', { user: { id: 'other' } });
  assert.equal(updates.length, 2);
});

test('rate-limited merchant polling stops before fetching and shows retry feedback', async () => {
  const source = fs.readFileSync('src/app/merchant/page.tsx', 'utf8');
  const start = source.indexOf('const fetchMerchantData = useCallback(') + 'const fetchMerchantData = useCallback('.length;
  const end = source.indexOf(', [staffAccess, merchantSlug]);', start);
  let access, message, orders;
  const pollScope = { exports: {}, staffAccess: 'allowed', refreshInFlight: { current: false }, orderRevision: { current: 0 }, controlRevision: { current: 0 },
    getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: null }, error: { status: 429 } }) } }),
    setStaffAccess: value => { access = value; }, setAccessMessage: value => { message = value; }, setOrders: value => { orders = value; }, setConnected: () => {},
    fetch: () => { throw Error('must not poll'); },
  };
  vm.runInNewContext(ts.transpileModule('exports.poll = ' + source.slice(start, end), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, pollScope);
  await pollScope.exports.poll();
  assert.equal(access, 'denied'); assert.match(message, /rate limited/); assert.equal(orders.length, 0);
  assert.equal(pollScope.refreshInFlight.current, false);
});
