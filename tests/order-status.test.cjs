const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadRoute({ guestHash = null, user = null } = {}) {
  const calls = [];
  const order = { id: 'test-order', status: 'placed', guest_session_hash: 'private', items: [{ qty: 1 }], events: [] };
  const sb = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      order.status = name === 'cancel_guest_order' ? 'cancelled' : args.next_status;
      return { data: { ...order }, error: null };
    },
    from: () => {
      const query = { select: () => query, eq: () => query, single: async () => ({ data: order, error: null }) };
      return query;
    },
  };
  const modules = {
    'next/server': { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } },
    '@/lib/server-db': { getSupabaseAdminClient: () => sb },
    '@/lib/supabase/server': { getVerifiedUser: async () => user },
    '@/lib/guest-session': { getGuestOrderHash: async () => guestHash, publicOrder: ({ guest_session_hash, ...visible }) => visible },
    '@/lib/site-access': { PUBLIC_MERCHANT_ACCESS: true },
  };
  const source = fs.readFileSync('src/app/api/orders/[id]/status/route.ts', 'utf8');
  const scope = { exports: {}, require: (name) => modules[name], process, console };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
  return { patch: (body) => scope.exports.PATCH({ json: async () => body }, { params: Promise.resolve({ id: order.id }) }), calls };
}

test('merchant UI accept action reaches public merchant RPC without authentication', async () => {
  const route = loadRoute();
  const source = fs.readFileSync('src/app/merchant/page.tsx', 'utf8');
  const handler = source.slice(source.indexOf('const handleOrderStatusChange ='), source.indexOf('const handleToggleItemStock ='));
  const scope = {
    exports: {}, staffRole: 'owner', setOrderActionError: () => {}, setRejectingOrderId: () => {},
    fetchMerchantData: async () => {}, notifyRealtimeUpdate: () => {},
    fetch: async (_, options) => {
      const result = await route.patch(JSON.parse(options.body));
      return { ok: result.status === 200, json: async () => result.data };
    },
  };
  vm.runInNewContext(ts.transpileModule(`${handler}\nexports.accept = handleOrderStatusChange;`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
  await scope.exports.accept('test-order', 'accepted', { prepTimeMin: 15 });
  assert.equal(route.calls[0].name, 'transition_public_order');
  assert.equal(route.calls[0].args.next_status, 'accepted');
  assert.equal(route.calls[0].args.preparation_minutes, 15);
});

test('guest cancellation preserves items and hides private cookie hash', async () => {
  const route = loadRoute({ guestHash: 'guest-cookie' });
  const result = await route.patch({ actor: 'customer', status: 'cancelled' });
  assert.equal(result.status, 200);
  assert.equal(result.data.order.status, 'cancelled');
  assert.equal(result.data.order.items[0].qty, 1);
  assert.equal(result.data.order.guest_session_hash, undefined);
});

test('guest cancellation also works with an older signed-in browser session', async () => {
  const route = loadRoute({ guestHash: 'guest-cookie', user: { id: 'older-user' } });
  const result = await route.patch({ actor: 'customer', status: 'cancelled' });
  assert.equal(result.status, 200);
  assert.equal(route.calls[0].name, 'cancel_guest_order');
});

test('anonymous customer without an order cookie cannot cancel', async () => {
  const route = loadRoute();
  const result = await route.patch({ actor: 'customer', status: 'cancelled' });
  assert.equal(result.status, 403);
  assert.equal(route.calls.length, 0);
});
