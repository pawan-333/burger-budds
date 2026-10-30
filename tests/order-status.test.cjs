const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const riderScope = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/order-rider.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, riderScope);
const { getOrderRider, parseRiderDetails, riderHandoverNote } = riderScope.exports;

function loadRoute({ guestHash = null, user = null, publicAccess = true, membership = null, rpcError = false } = {}) {
  const calls = [];
  const order = { id: 'test-order', status: 'placed', guest_session_hash: 'private', items: [{ qty: 1 }], events: [] };
  const sb = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (rpcError) return { data: null, error: { message: 'Transition failed' } };
      order.status = name === 'cancel_guest_order' ? 'cancelled' : args.next_status;
      if (args.next_status === 'out_for_delivery') order.events.push({ status: 'out_for_delivery', actor: 'merchant', note: args.rejection_reason, created_at: new Date().toISOString() });
      return { data: { ...order }, error: null };
    },
    from: (table) => {
      const query = { select: () => query, eq: () => query, single: async () => ({ data: order, error: null }), maybeSingle: async () => ({ data: table === 'super_admins' ? null : table === 'staff' ? membership : { ...order, outlet_id: 'store-a' }, error: null }) };
      return query;
    },
  };
  const modules = {
    'next/server': { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } },
    '@/lib/server-db': { getSupabaseAdminClient: () => sb },
    '@/lib/supabase/server': { getVerifiedUser: async () => user, getSupabaseServerClient: async () => sb },
    '@/lib/guest-session': { getGuestOrderHash: async () => guestHash, publicOrder: ({ guest_session_hash, ...visible }) => visible },
    '@/lib/site-access': { PUBLIC_MERCHANT_ACCESS: publicAccess },
    '@/lib/order-rider': riderScope.exports,
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
    getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'merchant-token' } } }) } }),
    exports: {}, staffRole: 'owner', setOrderActionError: () => {}, setRejectingOrderId: () => {},
    fetchMerchantData: async () => {}, notifyRealtimeUpdate: () => {},
    pendingOrderIds: { current: new Set() }, orderRevision: { current: 0 }, setPendingOrders: () => {}, setOrders: () => {},
    fetch: async (_, options) => {
      assert.equal(options.headers.Authorization, 'Bearer merchant-token');
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

test('handover saves normalized rider contact with the status and reloads from events', async () => {
  const route = loadRoute();
  const result = await route.patch({ status: 'out_for_delivery', riderName: ' Test Rider ', riderPhone: '90000 00000' });
  assert.equal(result.status, 200);
  assert.equal(result.data.order.status, 'out_for_delivery');
  const rider = getOrderRider(JSON.parse(JSON.stringify(result.data.order)));
  assert.equal(rider.name, 'Test Rider');
  assert.equal(rider.phone, '+919000000000');
  assert.equal(route.calls[0].name, 'transition_public_order');
});

test('private handover keeps staff membership checks and verified actor', async () => {
  const route = loadRoute({ publicAccess: false, user: { id: 'assigned-staff' }, membership: { outlet_id: 'store-a' } });
  const result = await route.patch({ status: 'out_for_delivery', riderName: 'Test Rider', riderPhone: '+91 90000 00000' });
  assert.equal(result.status, 200);
  assert.equal(route.calls[0].name, 'transition_order');
  assert.equal(route.calls[0].args.acting_user, 'assigned-staff');
  assert.equal(getOrderRider(result.data.order).phone, '+919000000000');
});

test('handover requires a real name and valid mobile before any status write', async () => {
  for (const details of [{}, { riderName: ' ', riderPhone: '9000000000' }, { riderName: 'Test Rider', riderPhone: '123' }, { riderName: 'Test Rider', riderPhone: '9000000000abc' }]) {
    const route = loadRoute();
    assert.equal((await route.patch({ status: 'out_for_delivery', ...details })).status, 400);
    assert.equal(route.calls.length, 0);
  }
});

test('rider contact cannot bypass private merchant authorization', async () => {
  for (const user of [null, { id: 'unassigned-staff' }]) {
    const route = loadRoute({ publicAccess: false, user });
    const result = await route.patch({ status: 'out_for_delivery', riderName: 'Test Rider', riderPhone: '9000000000' });
    assert.equal(result.status, 403);
    assert.equal(route.calls.length, 0);
  }
});

test('failed handover transaction is not reported as saved', async () => {
  const result = await loadRoute({ rpcError: true }).patch({ status: 'out_for_delivery', riderName: 'Test Rider', riderPhone: '9000000000' });
  assert.equal(result.status, 400);
  assert.equal(result.data.order, undefined);
});

test('tracking uses the latest handover and never invents rider details', () => {
  assert.equal(getOrderRider({ events: [] }), null);
  assert.equal(getOrderRider({ events: [{ status: 'out_for_delivery', actor: 'merchant', note: 'rider-handover:broken' }] }), null);
  const events = [
    { status: 'out_for_delivery', actor: 'merchant', created_at: '2026-01-01', note: riderHandoverNote(parseRiderDetails('Earlier Rider', '9000000000')) },
    { status: 'out_for_delivery', actor: 'merchant', created_at: '2026-02-01', note: riderHandoverNote(parseRiderDetails('Latest Rider', '9000000001')) },
    { status: 'delivered', actor: 'merchant', created_at: '2026-03-01', note: null },
  ];
  assert.equal(getOrderRider({ events }).name, 'Latest Rider');
  assert.equal(events[0].created_at, '2026-01-01');
});

test('handover form keeps inputs on save failure and closes only after success', async () => {
  const source = fs.readFileSync('src/app/merchant/page.tsx', 'utf8');
  const handler = source.slice(source.indexOf('const handleRiderHandover ='), source.indexOf('const handleToggleItemStock ='));
  for (const saved of [false, true]) {
    const calls = [], closed = [];
    const scope = { exports: {}, handoverOrderId: 'test-order', registeredRiderId: '', riderName: 'Test Rider', riderPhone: '9000000000', parseRiderDetails, setRiderError: () => {}, setRiderName: () => {}, setRiderPhone: () => {}, setHandoverOrderId: id => closed.push(id), handleOrderStatusChange: async (...args) => { calls.push(args); return saved; } };
    vm.runInNewContext(ts.transpileModule(handler + '\nexports.submit = handleRiderHandover;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
    await scope.exports.submit({ preventDefault() {} });
    assert.equal(calls[0][1], 'out_for_delivery');
    assert.equal(calls[0][2].riderPhone, '+919000000000');
    assert.equal(closed.length, saved ? 1 : 0);
  }
});

test('private merchant access rejects unauthenticated order updates', async () => {
  const route = loadRoute({ publicAccess: false });
  const result = await route.patch({ actor: 'merchant', status: 'accepted' });
  assert.equal(result.status, 403);
  assert.equal(route.calls.length, 0);
});

test('merchant cannot update an order without membership of its store', async () => {
  const route = loadRoute({ publicAccess: false, user: { id: 'other-store-merchant' } });
  const result = await route.patch({ actor: 'merchant', status: 'accepted' });
  assert.equal(result.status, 403);
  assert.equal(route.calls.length, 0);
});

test('assigned merchant can update its store order', async () => {
  const route = loadRoute({ publicAccess: false, user: { id: 'store-merchant' }, membership: { outlet_id: 'store-a' } });
  const result = await route.patch({ actor: 'merchant', status: 'accepted' });
  assert.equal(result.status, 200);
  assert.equal(route.calls[0].name, 'transition_order');
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

test('merchant status changes respond immediately and do not wait for a full dashboard reload', async () => {
  const source = fs.readFileSync('src/app/merchant/page.tsx', 'utf8');
  const handler = source.slice(source.indexOf('const handleOrderStatusChange ='), source.indexOf('const handleToggleItemStock ='));
  let finish;
  let requests = 0;
  let refreshes = 0;
  let pending = {};
  let orders = [{ id: 'order-a', status: 'placed' }];
  const response = new Promise(resolve => { finish = resolve; });
  const scope = {
    getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'merchant-token' } } }) } }),
    exports: {}, pendingOrderIds: { current: new Set() }, orderRevision: { current: 0 },
    setPendingOrders: update => { pending = update(pending); }, setOrders: update => { orders = update(orders); },
    setOrderActionError: () => {}, setRejectingOrderId: () => {}, notifyRealtimeUpdate: () => {},
    fetchMerchantData: async () => { refreshes++; }, fetch: () => { requests++; return response; },
  };
  vm.runInNewContext(ts.transpileModule(`${handler}\nexports.change = handleOrderStatusChange;`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
  const first = scope.exports.change('order-a', 'accepted');
  assert.equal(pending['order-a'], true);
  await scope.exports.change('order-a', 'accepted');
  assert.equal(requests, 1);
  finish({ ok: true, json: async () => ({ order: { id: 'order-a', status: 'accepted' } }) });
  await first;
  assert.equal(orders[0].status, 'accepted');
  assert.equal(refreshes, 0);
  assert.equal(pending['order-a'], undefined);
  assert.equal(scope.pendingOrderIds.current.size, 0);
});

test('failed merchant action clears pending feedback and preserves the saved order status', async () => {
  const source = fs.readFileSync('src/app/merchant/page.tsx', 'utf8');
  const handler = source.slice(source.indexOf('const handleOrderStatusChange ='), source.indexOf('const handleToggleItemStock ='));
  let pending = {};
  let errorMessage;
  let updates = 0;
  const scope = {
    getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'merchant-token' } } }) } }),
    exports: {}, pendingOrderIds: { current: new Set() }, orderRevision: { current: 0 },
    setPendingOrders: update => { pending = update(pending); }, setOrders: () => { updates++; },
    setOrderActionError: message => { errorMessage = message; }, setRejectingOrderId: () => {}, notifyRealtimeUpdate: () => {},
    fetch: async () => ({ ok: false, json: async () => ({ error: 'Access denied' }) }),
  };
  vm.runInNewContext(ts.transpileModule(`${handler}\nexports.change = handleOrderStatusChange;`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
  await scope.exports.change('order-a', 'ready');
  assert.equal(updates, 0);
  assert.equal(errorMessage, 'Access denied');
  assert.equal(pending['order-a'], undefined);
  assert.equal(scope.pendingOrderIds.current.size, 0);
});

test('unauthorized merchant polling returns to login and clears stale orders', async () => {
  const source = fs.readFileSync('src/app/merchant/page.tsx', 'utf8');
  const start = source.indexOf('const fetchMerchantData = useCallback(') + 'const fetchMerchantData = useCallback('.length;
  const end = source.indexOf(', [staffAccess, merchantSlug]);', start);
  let access, orders, connected;
  const scope = { exports: {}, staffAccess: 'allowed', merchantSlug: 'store', refreshInFlight: { current: false }, orderRevision: { current: 0 }, controlRevision: { current: 0 },
    getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'valid-token' } } }) } }),
    setStaffAccess: value => { access = value; }, setOrders: value => { orders = value; }, setConnected: value => { connected = value; },
    fetch: async (url, options) => { if (url.startsWith('/api/orders')) assert.equal(options.headers.Authorization, 'Bearer valid-token'); return { status: 401, ok: false }; },
  };
  vm.runInNewContext(ts.transpileModule('exports.poll = ' + source.slice(start, end), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
  await scope.exports.poll();
  assert.equal(access, 'login'); assert.equal(orders.length, 0); assert.equal(connected, false);
  assert.equal(scope.refreshInFlight.current, false);
});
