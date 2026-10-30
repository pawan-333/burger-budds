const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

const ENV = { CASHFREE_ENABLED: 'true', CASHFREE_ENV: 'sandbox', CASHFREE_CLIENT_ID: 'TEST_unit_only', CASHFREE_CLIENT_SECRET: 'cfsk_ma_test_unit_only', CASHFREE_SITE_URL: 'https://example.test' };
const LIVE_ENV = { ...ENV, CASHFREE_ENV: 'production', CASHFREE_CLIENT_ID: 'LIVE_unit_only', CASHFREE_CLIENT_SECRET: 'cfsk_ma_prod_unit_only', CASHFREE_SITE_URL: 'https://www.burgerbudds.in' };
function load(file, modules = {}, globals = {}) {
  const context = { exports: {}, Buffer, URL, AbortSignal, process: { env: { ...ENV } }, require: name => {
    if (name === 'crypto') return crypto;
    if (name in modules) return modules[name];
    throw Error('Unexpected dependency: ' + name);
  }, ...globals };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
}
const core = load('src/lib/cashfree.ts');
test('sandbox preview may use its deployment URL; production still requires the explicit approved site', () => {
  const preview = load('src/lib/cashfree.ts', {}, { process: { env: { ...ENV, CASHFREE_SITE_URL: '', VERCEL_ENV: 'preview', VERCEL_URL: 'burger-budds-preview.vercel.app' } } });
  assert.equal(preview.cashfreeConfig().origin, 'https://burger-budds-preview.vercel.app');
  const live = load('src/lib/cashfree.ts', {}, { process: { env: { ...LIVE_ENV, CASHFREE_SITE_URL: '', VERCEL_ENV: 'preview', VERCEL_URL: 'burger-budds-preview.vercel.app' } } });
  assert.equal(live.cashfreeEnabled(), false);
});
const next = { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } };
const ID = '11111111-1111-4111-8111-111111111111';
const providerId = 'bb_' + ID.replaceAll('-', '');
const signed = (raw, timestamp) => crypto.createHmac('sha256', ENV.CASHFREE_CLIENT_SECRET).update(timestamp + raw).digest('base64');
test('environment copy whitespace does not corrupt credential headers or webhook verification', () => {
  const instance = load('src/lib/cashfree.ts', {}, { process: { env: { ...ENV, CASHFREE_CLIENT_ID: ' ' + ENV.CASHFREE_CLIENT_ID + '\r\n', CASHFREE_CLIENT_SECRET: ENV.CASHFREE_CLIENT_SECRET + '\r\n' } } });
  assert.equal(instance.cashfreeConfig().clientId, ENV.CASHFREE_CLIENT_ID);
  assert.equal(instance.validCashfreeSignature('{}', '1793090000000', signed('{}', '1793090000000')), true);
});

test('sandbox is fail-closed for disabled flag, missing config and production credentials/mode', () => {
  for (const patch of [{ CASHFREE_ENABLED: 'false' }, { CASHFREE_ENV: 'production' }, { CASHFREE_CLIENT_ID: 'PROD_id' }, { CASHFREE_CLIENT_SECRET: '' }, { CASHFREE_SITE_URL: 'http://example.test' }, { CASHFREE_SITE_URL: 'https://www.burgerbudds.in' }]) {
    const instance = load('src/lib/cashfree.ts', {}, { process: { env: { ...ENV, ...patch } } });
    assert.equal(instance.cashfreeEnabled(), false);
  }
  assert.equal(core.cashfreeEnabled(), true);
});
test('production accepts only live keys and the approved HTTPS domain; sandbox keys never enable live checkout', async () => {
  let requestUrl;
  const live = load('src/lib/cashfree.ts', {}, { process: { env: LIVE_ENV }, fetch: async url => { requestUrl = url; return { ok: true, json: async () => ({}) }; } });
  assert.equal(live.cashfreeEnabled(), true);
  assert.equal(live.cashfreeConfig().mode, 'production');
  await live.cashfreeRequest('/orders/unit-check');
  assert.equal(requestUrl, 'https://api.cashfree.com/pg/orders/unit-check');
  for (const patch of [{ CASHFREE_CLIENT_ID: ENV.CASHFREE_CLIENT_ID }, { CASHFREE_CLIENT_SECRET: ENV.CASHFREE_CLIENT_SECRET }, { CASHFREE_SITE_URL: 'https://evil.test' }, { CASHFREE_SITE_URL: 'http://www.burgerbudds.in' }, { CASHFREE_ENV: 'unknown' }]) {
    assert.equal(load('src/lib/cashfree.ts', {}, { process: { env: { ...LIVE_ENV, ...patch } } }).cashfreeEnabled(), false);
  }
});
test('webhook requires the exact raw payload, valid HMAC and headers', () => {
  const raw = '{ "amount": 1.00 }'; const time = '1793090000000';
  assert.equal(core.validCashfreeSignature(raw, time, signed(raw, time)), true);
  for (const body of [raw.replace('1.00', '100'), JSON.stringify(JSON.parse(raw))]) {
    assert.equal(core.validCashfreeSignature(body, time, signed(raw, time)), false);
  }
  assert.equal(core.validCashfreeSignature(raw, time, 'invalid'), false);
  assert.equal(core.validCashfreeSignature(raw, null, signed(raw, time)), false);
});
test('verification requires paid order, successful payment, exact identity, INR and amount', () => {
  const order = { order_id: providerId, order_status: 'PAID', order_amount: 447, order_currency: 'INR' };
  const payment = { cf_payment_id: '1234', payment_status: 'SUCCESS', payment_amount: 447, payment_currency: 'INR' };
  assert.equal(core.successfulCashfreePayment(order, [payment], providerId, 447).cf_payment_id, '1234');
  for (const patch of [{ order_id: 'other' }, { order_status: 'ACTIVE' }, { order_amount: 446 }, { order_currency: 'USD' }]) {
    assert.equal(core.successfulCashfreePayment({ ...order, ...patch }, [payment], providerId, 447), null);
  }
  for (const patch of [{ payment_status: 'FAILED' }, { payment_amount: 1 }, { payment_currency: 'USD' }, { cf_payment_id: 'bad-id' }, { cf_payment_id: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.equal(core.successfulCashfreePayment(order, [{ ...payment, ...patch }], providerId, 447), null);
  }
});
test('provider calls use sandbox, timeout and server headers; errors do not leak provider bodies', async () => {
  let requested;
  const instance = load('src/lib/cashfree.ts', {}, { fetch: async (url, options) => { requested = { url, options }; return { ok: false, status: 500, json: () => { throw Error('must not read error body'); } }; } });
  await assert.rejects(instance.cashfreeRequest('/orders', { key: ID, body: { order_amount: 447 } }), /temporarily unavailable/);
  assert.equal(requested.url, 'https://sandbox.cashfree.com/pg/orders');
  assert.equal(requested.options.headers['x-idempotency-key'], ID);
  assert.equal(requested.options.headers['x-client-secret'], ENV.CASHFREE_CLIENT_SECRET);
  assert.ok(requested.options.signal);
});

function service({ user = null, guest = null, order = { id: ID, user_id: 'owner', guest_session_hash: 'guest-owner', payment_method: 'cashfree' }, record = {}, provider = null, payments = [], mode = 'sandbox', createdProvider = null } = {}) {
  const calls = [];
  const requests = [];
  const row = { order_id: ID, provider_order_id: providerId, environment: 'sandbox', amount: 447, state: 'pending', expires_at: '2099-01-01T00:00:00Z', ...record };
  const db = {
    from(table) { const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: order }), single: async () => ({ data: row }) }; return query; },
    rpc: async (name, args) => { calls.push({ name, args }); return { data: { refund_required: false }, error: null }; }
  };
  const instance = load('src/lib/cashfree-orders.ts', {
    '@/lib/server-db': { getSupabaseAdminClient: () => db }, '@/lib/supabase/server': { getVerifiedUser: async () => user },
    '@/lib/guest-session': { getGuestOrderHash: async () => guest },
    '@/lib/cashfree': { ...(mode === 'production' ? load('src/lib/cashfree.ts', {}, { process: { env: LIVE_ENV } }) : core), cashfreeRequest: async (endpoint, options) => { requests.push({ endpoint, options }); return options ? createdProvider : endpoint.endsWith('/payments') ? payments : provider; } }
  });
  return { instance, calls, requests };
}
test('live checkout requests only UPI using stored amount and an environment-matched record', async () => {
  const runtime = service({ mode: 'production', record: { environment: 'production' }, createdProvider: { order_id: providerId, order_status: 'ACTIVE', order_currency: 'INR', order_amount: 447, payment_session_id: 'live-session' } });
  const session = await runtime.instance.createCashfreeSession({ id: ID, status: 'placed', payment_status: 'pending', customer_phone: '9000000000', grand_total: 1 });
  assert.equal(session.mode, 'production');
  const creation = runtime.requests.find(request => request.options);
  assert.equal(creation.options.body.order_amount, 447);
  assert.equal(creation.options.body.order_meta.payment_methods, 'upi');
  assert.ok(creation.options.body.order_meta.return_url.startsWith('https://www.burgerbudds.in/track/'));
  assert.equal(creation.options.key, ID);
});
test('live and sandbox payment records cannot cross environment boundaries', async () => {
  for (const [mode, environment] of [['production', 'sandbox'], ['sandbox', 'production']]) {
    const runtime = service({ mode, record: { environment } });
    await assert.rejects(runtime.instance.reconcileCashfreeOrder(ID), /environment mismatch/);
    assert.equal(runtime.requests.length, 0); assert.equal(runtime.calls.length, 0);
  }
});
test('payment access requires exact user or guest cookie ownership, including mixed sessions', async () => {
  for (const input of [{}, { user: { id: 'other' } }, { guest: 'wrong' }]) assert.equal(await service(input).instance.ownedCashfreeOrder(ID), null);
  assert.ok(await service({ user: { id: 'owner' } }).instance.ownedCashfreeOrder(ID));
  assert.ok(await service({ user: { id: 'other' }, guest: 'guest-owner' }).instance.ownedCashfreeOrder(ID));
  assert.equal(await service().instance.ownedCashfreeOrder('not-a-uuid'), null);
});
test('pending and mismatched provider payments never mark an order paid', async () => {
  const pending = service({ provider: { order_id: providerId, order_status: 'ACTIVE' } });
  assert.equal((await pending.instance.reconcileCashfreeOrder(ID)).paid, false); assert.equal(pending.calls.length, 0);
  const wrong = service({ provider: { order_id: providerId, order_status: 'PAID', order_currency: 'INR', order_amount: 1 }, payments: [{ payment_status: 'SUCCESS', cf_payment_id: '1234', payment_amount: 1, payment_currency: 'INR' }] });
  await assert.rejects(wrong.instance.reconcileCashfreeOrder(ID), /mismatch/); assert.equal(wrong.calls.length, 0);
});
test('verified payment reaches the atomic confirmation RPC using stored identity and amount', async () => {
  const runtime = service({ provider: { order_id: providerId, order_status: 'PAID', order_currency: 'INR', order_amount: 447 }, payments: [{ payment_status: 'SUCCESS', cf_payment_id: '1234', payment_amount: 447, payment_currency: 'INR' }] });
  assert.equal((await runtime.instance.reconcileCashfreeOrder(ID)).paid, true);
  assert.equal(runtime.calls[0].name, 'confirm_cashfree_payment');
  assert.equal(runtime.calls[0].args.paid_amount, 447); assert.equal(runtime.calls[0].args.provider_order, providerId);
});
test('already paid records are idempotent without another confirmation write', async () => {
  const runtime = service({ record: { state: 'paid', refund_required: true } });
  assert.equal((await runtime.instance.reconcileCashfreeOrder(ID)).refundRequired, true); assert.equal(runtime.calls.length, 0);
});
test('checkout reuses an active provider session only when its amount and currency match', async () => {
  const provider = { order_id: providerId, order_status: 'ACTIVE', order_currency: 'INR', order_amount: 447, payment_session_id: 'test-session' };
  const order = { id: ID, status: 'placed', payment_status: 'pending', customer_phone: '9000000000' };
  const runtime = service({ provider });
  assert.equal((await runtime.instance.createCashfreeSession(order)).paymentSessionId, 'test-session');
  for (const patch of [{ order_amount: 1 }, { order_currency: 'USD' }, { order_id: 'different' }, { order_status: 'PAID' }]) {
    await assert.rejects(service({ provider: { ...provider, ...patch } }).instance.createCashfreeSession(order), /not active/);
  }
  await assert.rejects(runtime.instance.createCashfreeSession({ ...order, status: 'cancelled' }), /cannot be paid/);
  await assert.rejects(runtime.instance.createCashfreeSession({ ...order, payment_status: 'paid' }), /cannot be paid/);
  await assert.rejects(service({ record: { expires_at: '2020-01-01T00:00:00Z' } }).instance.createCashfreeSession(order), /expired/);
});
test('expired provider sessions and expired uncreated sessions cancel through guarded RPC', async () => {
  for (const input of [{ provider: { order_id: providerId, order_status: 'EXPIRED' } }, { record: { expires_at: '2020-01-01T00:00:00Z' } }]) {
    const runtime = service(input); assert.equal((await runtime.instance.reconcileCashfreeOrder(ID)).expired, true); assert.equal(runtime.calls[0].name, 'expire_cashfree_order');
  }
});
test('forged webhook is rejected before reconciliation; signed callbacks still reconcile server-side', async () => {
  let reconciled = 0;
  const route = load('src/app/api/payments/cashfree/webhook/route.ts', { 'next/server': next, '@/lib/cashfree': core, '@/lib/cashfree-orders': { reconcileCashfreeOrder: async id => { assert.equal(id, ID); reconciled++; } } });
  const raw = JSON.stringify({ data: { order: { order_id: providerId } } }); const time = '1793090000000';
  const req = signature => ({ text: async () => raw, headers: { get: key => key === 'x-webhook-signature' ? signature : time } });
  assert.equal((await route.POST(req('forged'))).status, 401); assert.equal(reconciled, 0);
  assert.equal((await route.POST(req(signed(raw, time)))).status, 200); assert.equal(reconciled, 1);
});
test('session/status routes do not expose or reconcile an unowned order', async () => {
  const modules = { 'next/server': next, '@/lib/cashfree': { cashfreeEnabled: () => true }, '@/lib/cashfree-orders': { ownedCashfreeOrder: async () => null, createCashfreeSession: () => assert.fail('unowned session'), reconcileCashfreeOrder: () => assert.fail('unowned status') } };
  for (const file of ['src/app/api/payments/cashfree/route.ts', 'src/app/api/payments/cashfree/status/route.ts']) {
    assert.equal((await load(file, modules).POST({ json: async () => ({ orderId: ID }) })).status, 404);
  }
});
