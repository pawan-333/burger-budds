const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, modules = {}, extra = {}) {
  const scope = { exports: {}, require: name => { if (!(name in modules)) throw Error(name); return modules[name]; }, ...extra };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
  return scope.exports;
}
const { collectionLabel } = load('src/lib/payment-collection.ts');
test('cash declaration, verified delivery UPI and prepaid remain distinguishable', () => {
  assert.match(collectionLabel({ payment_method: 'cod', payment_status: 'paid', collection_method: 'cash' }), /rider confirmed/);
  assert.match(collectionLabel({ payment_method: 'cod', payment_status: 'paid', collection_method: 'upi_delivery' }), /UPI at delivery/);
  assert.match(collectionLabel({ payment_method: 'cashfree', payment_status: 'paid' }), /Online prepaid/);
  assert.match(collectionLabel({ payment_method: 'cod', payment_status: 'paid' }), /source unavailable/);
  assert.match(collectionLabel({ payment_method: 'cod', payment_status: 'pending' }), /Collect/);
  assert.match(collectionLabel({ payment_status: 'refunded', collection_method: 'upi_delivery' }), /refunded/);
});
const ID = '11111111-1111-4111-8111-111111111111';
function paymentRoute({ user = { id: 'verified-user' }, order = { id: ID, status: 'out_for_delivery', payment_method: 'cod', payment_status: 'pending' }, enabled = true, rpcError = null } = {}) {
  const calls = [];
  const query = { select: () => query, eq: (key, value) => { calls.push([key, value]); return query; }, maybeSingle: async () => ({ data: order }) };
  const db = { from: () => query, rpc: async (name, args) => { calls.push({ name, args }); return { error: rpcError }; } };
  const helpers = { getRiderAccount: async id => { calls.push(['account', id]); return { db, account: { rider_id: 'rider-a', outlet_id: 'outlet-a' } }; }, isRiderUuid: id => id === ID,
    riderJson: (body, status = 200) => ({ body, status }), riderError: () => ({ status: 503 }), riderRpcError: () => ({ status: 409 }) };
  const api = load('src/app/api/rider/orders/[id]/payment/route.ts', {
    '@/lib/supabase/server': { getVerifiedUser: async () => user }, '@/lib/rider-access': helpers,
    '@/lib/cashfree': { cashfreeEnabled: () => enabled, cashfreeConfig: () => ({ mode: 'sandbox' }) },
    '@/lib/cashfree-orders': { createCashfreeDeliveryQr: async () => { calls.push('qr'); return { qrCode: 'data:image/png;base64,AA==', mode: 'sandbox' }; }, reconcileCashfreeOrder: async id => { calls.push(['reconcile', id]); return { paid: false }; } },
  });
  return { api, calls };
}
const params = { params: Promise.resolve({ id: ID }) };
const request = (action = 'start', bearer = true) => ({ headers: new Headers(bearer ? { authorization: 'Bearer fixture' } : {}), json: async () => ({ action, amount: 1, acting_user: 'forged' }) });
test('anonymous or missing-bearer callers cannot start or inspect rider payments', async () => {
  for (const [user, bearer] of [[null, true], [{ id: 'rider' }, false]]) {
    const { api, calls } = paymentRoute({ user });
    assert.equal((await api.POST(request('start', bearer), params)).status, 401);
    assert.equal(calls.length, 0);
  }
});
test('rider payment scopes order by assignment, outlet and delivery before RPC', async () => {
  const { api, calls } = paymentRoute();
  const response = await api.POST(request(), params);
  assert.equal(response.status, 200);
  assert.equal(response.body.qrCode, 'data:image/png;base64,AA==');
  assert.ok(calls.includes('qr'));
  for (const pair of [['rider_id','rider-a'],['outlet_id','outlet-a'],['order_type','delivery']]) assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(pair)));
  const rpc = calls.find(call => call.name);
  assert.equal(rpc.args.acting_user, 'verified-user');
  assert.equal(rpc.args.target_order_id, ID);
  assert.equal('amount' in rpc.args, false);
});
test('unassigned, prepaid, stale and disabled orders cannot create UPI sessions', async () => {
  for (const options of [{ order: null }, { order: { status: 'delivered' } }, { order: { status: 'out_for_delivery', payment_method: 'cashfree' } }, { order: { status: 'out_for_delivery', payment_method: 'cod', payment_status: 'refunded' } }, { enabled: false }, { rpcError: { code: '22023' } }]) {
    const { api, calls } = paymentRoute(options);
    assert.ok((await api.POST(request(), params)).status >= 400);
    assert.ok(!calls.includes('session'));
  }
});
test('checking an existing attempt reconciles even if new payments are disabled', async () => {
  const { api, calls } = paymentRoute({ enabled: false });
  assert.equal((await api.POST(request('check'), params)).status, 200);
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'reconcile'));
  assert.ok(!calls.some(call => call.name));
});
test('paid COD does not open a second payment session', async () => {
  const { api, calls } = paymentRoute({ order: { id: ID, status: 'out_for_delivery', payment_method: 'cod', payment_status: 'paid' } });
  assert.equal((await api.POST(request(), params)).body.paid, true);
  assert.ok(!calls.includes('session'));
});
