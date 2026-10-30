const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const ORDER = '11111111-1111-4111-8111-111111111111';
const RIDER = '22222222-2222-4222-8222-222222222222';
const USER = 'verified-rider-user';
const OUTLET = 'outlet-a';
const responseModule = { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers }) } };
function load(file, modules) {
  const scope = { exports: {}, require: name => { if (!(name in modules)) throw new Error('Unmocked import: ' + name); return modules[name]; }, console, URL, Date, process };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, scope);
  return scope.exports;
}
function database(resolve, rpcResult = { data: { id: ORDER, status: 'delivered' }, error: null }) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => { calls.push({ rpc: name, args }); return rpcResult; },
    from(table) {
      const call = { table, operations: [] }; calls.push(call);
      const query = {};
      for (const method of ['select', 'eq', 'or', 'order', 'limit', 'gte']) query[method] = (...args) => { call.operations.push([method, ...args]); return query; };
      query.maybeSingle = () => Promise.resolve(resolve(call));
      query.then = (yes, no) => Promise.resolve(resolve(call)).then(yes, no);
      return query;
    },
  };
}
const account = { rider_id: RIDER, outlet_id: OUTLET, rider: { id: RIDER, name: 'Test Rider', phone: '+919000000000', is_active: true }, outlet: { name: 'Test Store' } };
const delivery = {
  id: ORDER, order_no: 'BB-TEST', customer_name: 'Test Customer', customer_phone: '+919000000001',
  address_snapshot: { house: 'Test building', landmark: '', locality: 'Test area', city: 'Test city', lat: 26, lng: 78, email: 'private@example.invalid', user_id: 'private-user' },
  special_instructions: 'Ring once', grand_total: '149.50', payment_method: 'cod', payment_status: 'pending',
  guest_session_hash: 'private-cookie-hash', items: [{ item_name: 'Test Burger', qty: 2, variant: null, unit_price: 500 }],
};
function helper(db) { return load('src/lib/rider-access.ts', { 'next/server': responseModule, '@/lib/server-db': { getSupabaseAdminClient: () => db } }); }

test('rider dashboard scopes active/history to verified rider and outlet, with bounded results', async () => {
  const db = database(call => ({ data: call.table === 'rider_accounts' ? account : call.operations.some(op => op[0] === 'eq' && op[2] === 'out_for_delivery') ? [delivery] : [], error: null }));
  const data = await helper(db).getRiderDashboard(USER);
  assert.equal(data.active[0].cod_due, 149.5);
  assert.ok(db.calls[0].operations.some(op => op[0] === 'eq' && op[1] === 'user_id' && op[2] === USER));
  for (const call of db.calls.filter(call => call.table === 'orders')) {
    for (const [key, value] of [['rider_id', RIDER], ['outlet_id', OUTLET], ['order_type', 'delivery']]) assert.ok(call.operations.some(op => op[0] === 'eq' && op[1] === key && op[2] === value));
    assert.ok(call.operations.some(op => op[0] === 'limit'));
  }
  const history = db.calls.find(call => call.operations?.some(op => op[0] === 'eq' && op[2] === 'delivered'));
  assert.equal(history.operations.find(op => op[0] === 'select')[1], 'id,order_no,delivered_at');
  assert.ok(history.operations.some(op => op[0] === 'gte' && op[1] === 'delivered_at'));
});

test('dashboard payload excludes address email, identity, raw prices, session hashes and event notes', () => {
  const result = helper(database(() => ({}))).toRiderDelivery(delivery);
  const json = JSON.stringify(result);
  for (const forbidden of ['private@example', 'private-user', 'private-cookie', 'unit_price', 'guest_session', 'user_id']) assert.ok(!json.includes(forbidden));
  assert.equal(result.items[0].name, 'Test Burger');
});

test('paid orders never show cash due; zero COD is not falsely labelled paid', () => {
  const h = helper(database(() => ({})));
  for (const payment_method of ['cashfree', 'cod']) assert.equal(h.toRiderDelivery({ ...delivery, payment_method, payment_status: 'paid' }).cod_due, 0);
  assert.equal(h.toRiderDelivery({ ...delivery, grand_total: 0 }).payment_label, 'No cash due');
  assert.throws(() => h.toRiderDelivery({ ...delivery, grand_total: 'invalid' }), /amount/);
});

test('unprovisioned, disabled or unavailable rider accounts never read orders', async () => {
  for (const result of [{ data: null, error: null }, { data: { ...account, rider: { ...account.rider, is_active: false } }, error: null }, { data: null, error: { code: '42P01' } }]) {
    const db = database(() => result);
    await assert.rejects(helper(db).getRiderDashboard(USER));
    assert.equal(db.calls.length, 1);
    assert.ok(db.calls[0].operations.some(op => op[0] === 'eq' && op[1] === 'is_active' && op[2] === true));
  }
});

test('failed order query returns unavailable instead of misleading empty dashboard', async () => {
  const db = database(call => call.table === 'rider_accounts' ? { data: account } : { error: { message: 'private database detail' } });
  const h = helper(db);
  let failure;
  try { await h.getRiderDashboard(USER); } catch (err) { failure = err; }
  const response = h.riderError(failure);
  assert.equal(response.status, 503);
  assert.ok(!JSON.stringify(response).includes('private database detail'));
});

test('missing Supabase configuration returns unavailable without dereferencing a client', async () => {
  const h = helper(null);
  await assert.rejects(h.getRiderDashboard(USER), error => error.status === 503);
  await assert.rejects(h.getAssignableRiders(USER, ORDER), error => error.status === 503);
});

test('merchant cannot list riders for an unrelated outlet, even with a known order ID', async () => {
  const db = database(call => ({ data: call.table === 'orders' ? { outlet_id: OUTLET, status: 'ready', order_type: 'delivery' } : null, error: null }));
  await assert.rejects(helper(db).getAssignableRiders('other-outlet-staff', ORDER), error => error.status === 404);
  assert.ok(!db.calls.some(call => call.table === 'rider_accounts'));
  assert.ok(db.calls.find(call => call.table === 'staff').operations.some(op => op[0] === 'eq' && op[1] === 'outlet_id' && op[2] === OUTLET));
});

test('authorized merchant receives only active provisioned riders from the order outlet', async () => {
  const db = database(call => ({ data: call.table === 'orders' ? { outlet_id: OUTLET, status: 'ready', order_type: 'delivery' } : call.table === 'staff' ? { user_id: USER } : call.table === 'rider_accounts' ? [{ rider: account.rider }] : null, error: null }));
  const riders = await helper(db).getAssignableRiders(USER, ORDER);
  assert.equal(riders[0].id, RIDER);
  assert.deepEqual(Object.keys(riders[0]).sort(), ['id', 'name', 'phone']);
  const query = db.calls.find(call => call.table === 'rider_accounts');
  for (const [key, value] of [['outlet_id', OUTLET], ['is_active', true], ['rider.is_active', true]]) assert.ok(query.operations.some(op => op[0] === 'eq' && op[1] === key && op[2] === value));
});

function route(file, { user = { id: USER }, rpcError = null } = {}) {
  const db = database(() => ({ data: account }), { data: { id: ORDER, status: 'delivered', guest_session_hash: 'hidden' }, error: rpcError });
  const helpers = helper(db);
  const modules = {
    'next/server': responseModule,
    '@/lib/server-db': { getSupabaseAdminClient: () => db },
    '@/lib/supabase/server': { getVerifiedUser: async () => user },
    '@/lib/rider-access': helpers,
    '@/lib/order-rider': {}, '@/lib/site-access': { PUBLIC_MERCHANT_ACCESS: true },
    '@/lib/guest-session': { publicOrder: ({ guest_session_hash, ...rest }) => rest },
  };
  return { api: load(file, modules), db };
}
const completePath = 'src/app/api/rider/orders/[id]/complete/route.ts';
const params = { params: Promise.resolve({ id: ORDER }) };
const request = (bearer = true, body = {}) => ({ headers: new Headers(bearer ? { authorization: 'Bearer fixture-token' } : {}), json: async () => body });

test('delivery completion rejects missing/invalid sessions without touching database', async () => {
  for (const options of [{ bearer: false, user: { id: USER } }, { bearer: true, user: null }]) {
    const { api, db } = route(completePath, options);
    assert.equal((await api.POST(request(options.bearer), params)).status, 401);
    assert.equal(db.calls.length, 0);
  }
});

test('completion uses verified identity, ignores client-supplied actor/payment fields and has no-store response', async () => {
  const { api, db } = route(completePath);
  const result = await api.POST(request(true, { acting_user: 'victim', status: 'cancelled', payment_status: 'paid' }), params);
  assert.equal(result.status, 200);
  assert.equal(db.calls[0].rpc, 'complete_rider_delivery');
  assert.equal(db.calls[0].args.acting_user, USER);
  assert.deepEqual(Object.keys(db.calls[0].args).sort(), ['acting_user', 'target_order_id']);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
});

test('completion rejects malformed order IDs before RPC', async () => {
  const { api, db } = route(completePath);
  assert.equal((await api.POST(request(), { params: Promise.resolve({ id: 'not-an-id' }) })).status, 400);
  assert.equal(db.calls.length, 0);
});

test('database access denial, stale status and missing migration fail closed with sanitized errors', async () => {
  for (const [code, status] of [['42501', 404], ['22023', 409], ['PGRST202', 503]]) {
    const { api } = route(completePath, { rpcError: { code, message: 'internal secret detail' } });
    const result = await api.POST(request(), params);
    assert.equal(result.status, status);
    assert.ok(!JSON.stringify(result).includes('internal secret'));
  }
});

test('registered handover cannot use public merchant bypass and uses stored rider identity', async () => {
  const path = 'src/app/api/orders/[id]/status/route.ts';
  const denied = route(path, { user: null });
  assert.equal((await denied.api.PATCH(request(true, { status: 'out_for_delivery', riderId: RIDER }), params)).status, 401);
  assert.equal(denied.db.calls.length, 0);
  const allowed = route(path);
  const result = await allowed.api.PATCH(request(true, { status: 'out_for_delivery', riderId: RIDER, riderName: 'Forged contact', riderPhone: 'bad', acting_user: 'victim' }), params);
  assert.equal(result.status, 200);
  assert.equal(result.body.order.guest_session_hash, undefined);
  assert.equal(allowed.db.calls[0].rpc, 'assign_order_rider');
  assert.equal(allowed.db.calls[0].args.acting_user, USER);
  assert.equal(allowed.db.calls[0].args.target_rider_id, RIDER);
  assert.equal(Object.keys(allowed.db.calls[0].args).length, 3);
});

test('registered assignment rejects incompatible actions before any RPC', async () => {
  for (const body of [{ status: 'delivered', riderId: RIDER }, { status: 'out_for_delivery', actor: 'customer', riderId: RIDER }, { status: 'out_for_delivery', riderId: 'bad' }]) {
    const { api, db } = route('src/app/api/orders/[id]/status/route.ts');
    assert.equal((await api.PATCH(request(true, body), params)).status, 400);
    assert.equal(db.calls.length, 0);
  }
});

test('unauthenticated rider and merchant-list endpoints do not query data', async () => {
  for (const file of ['src/app/api/rider/orders/route.ts', 'src/app/api/riders/route.ts']) {
    const { api, db } = route(file, { user: null });
    const result = await api.GET(request());
    assert.equal(result.status, 401);
    assert.equal(db.calls.length, 0);
  }
});

test('registered handover form sends rider ID without manual contact and preserves selection on failure', async () => {
  const source = fs.readFileSync('src/app/merchant/page.tsx', 'utf8');
  const handler = source.slice(source.indexOf('const handleRiderHandover ='), source.indexOf('const handleToggleItemStock ='));
  for (const saved of [false, true]) {
    const calls = [], selections = [], closed = [];
    const scope = {
      exports: {}, handoverOrderId: ORDER, registeredRiderId: RIDER,
      setRiderError: () => {}, setRiderName: () => {}, setRiderPhone: () => {},
      setRegisteredRiderId: id => selections.push(id), setHandoverOrderId: id => closed.push(id),
      handleOrderStatusChange: async (...args) => { calls.push(args); return saved; },
    };
    vm.runInNewContext(ts.transpileModule(handler + '\nexports.submit = handleRiderHandover;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
    await scope.exports.submit({ preventDefault() {} });
    assert.equal(calls[0][2].riderId, RIDER);
    assert.equal(calls[0][2].riderPhone, undefined);
    assert.equal(selections.length, saved ? 1 : 0);
    assert.equal(closed.length, saved ? 1 : 0);
  }
});

function pinRoute({ user = { id: USER }, admin = true, phone = '919000000000', updateError = null } = {}) {
  const calls = [];
  const db = {
    from(table) {
      const query = { select: () => query, eq: () => query,
        maybeSingle: async () => ({ data: table === 'super_admins' ? admin ? { user_id: USER } : null : { user_id: USER, rider: account.rider }, error: null }),
        update: data => { calls.push({ activation: data }); return query; },
        then: resolve => Promise.resolve({ data: [], error: null }).then(resolve),
      }; return query;
    },
    auth: { admin: {
      getUserById: async () => ({ data: { user: { phone, email: `rider-${phone}@riders.burgerbudds.invalid` } }, error: null }),
      updateUserById: async (id, changes) => { calls.push({ id, changes }); return { error: updateError }; },
    } },
  };
  const parsed = load('src/lib/order-rider.ts', {});
  const loginIdentity = load('src/lib/rider-login.ts', { '@/lib/order-rider': parsed });
  const api = load('src/app/api/admin/riders/route.ts', {
    '@/lib/supabase/server': { getVerifiedUser: async () => user },
    '@/lib/rider-access': helper(db), '@/lib/order-rider': parsed,
    '@/lib/rider-login': loginIdentity,
  });
  return { api, calls };
}

test('PIN setup requires bearer authentication and super-admin role', async () => {
  for (const [config, bearer, status] of [[{}, false, 401], [{ user: null }, true, 401], [{ admin: false }, true, 403]]) {
    const { api, calls } = pinRoute(config);
    assert.equal((await api.POST(request(bearer, { riderId: RIDER, pin: '482719' }))).status, status);
    assert.equal(calls.length, 0);
  }
});

test('PIN setup rejects short, repeated and sequential PINs without changing credentials', async () => {
  for (const pin of ['4321', '123456', '654321', '111111', 'ab1234']) {
    const { api, calls } = pinRoute();
    assert.equal((await api.POST(request(true, { riderId: RIDER, pin }))).status, 400);
    assert.equal(calls.length, 0);
  }
});

test('PIN setup refuses mismatched Auth identity and does not activate on password failure', async () => {
  const mismatch = pinRoute({ phone: '919999999999' });
  assert.equal((await mismatch.api.POST(request(true, { riderId: RIDER, pin: '482719' }))).status, 409);
  assert.equal(mismatch.calls.length, 0);
  const rejected = pinRoute({ updateError: { message: 'secret provider detail' } });
  const response = await rejected.api.POST(request(true, { riderId: RIDER, pin: '482719' }));
  assert.equal(response.status, 400);
  assert.ok(!rejected.calls.some(call => call.activation));
  assert.ok(!JSON.stringify(response).includes('secret provider detail'));
});

test('PIN is sent only to Auth password storage; activation response does not return it', async () => {
  const { api, calls } = pinRoute();
  const response = await api.POST(request(true, { riderId: RIDER, pin: '482719' }));
  assert.equal(response.status, 200);
  assert.equal(calls[0].id, USER);
  assert.equal(calls[0].changes.password, '482719');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].activation)), { is_active: true });
  assert.ok(!JSON.stringify(response).includes('482719'));
});

test('rider login maps normalized mobile to its provisioned identity and requires six-digit PIN', async () => {
  const source = fs.readFileSync('src/app/rider/page.tsx', 'utf8');
  const handler = source.slice(source.indexOf('async function signIn('), source.indexOf('async function signOut('));
  const parsed = load('src/lib/order-rider.ts', {});
  const loginIdentity = load('src/lib/rider-login.ts', { '@/lib/order-rider': parsed });
  for (const password of ['482719', '4321']) {
    const calls = [], errors = [];
    const scope = { exports: {}, signingIn: false, mobile: '90000 00000', password,
      setSigningIn: () => {}, setError: message => errors.push(message), setPassword: () => {}, riderLoginIdentity: loginIdentity.riderLoginIdentity,
      getSupabaseBrowserClient: () => ({ auth: { signInWithPassword: async body => { calls.push(body); return { error: null }; } } }),
    };
    vm.runInNewContext(ts.transpileModule(handler + '\nexports.signIn = signIn;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);
    await scope.exports.signIn({ preventDefault() {} });
    assert.equal(calls.length, password.length === 6 ? 1 : 0);
    if (calls.length) { assert.equal(calls[0].email, 'rider-919000000000@riders.burgerbudds.invalid'); }
    else assert.ok(errors.at(-1).includes('6-digit PIN'));
  }
});
