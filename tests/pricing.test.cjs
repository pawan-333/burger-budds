const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('src/lib/pricing.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const scope = { exports: {}, require, Date, Math, Number, Set, Error };
vm.runInNewContext(source, scope);
const price = scope.exports.computeServerBill;
const item = { id: 'burger', price: 100, is_available: true, variants: [{ id: 'double', price_delta: 50 }], addon_groups: [{ min_select: 0, max_select: 1, addons: [{ id: 'cheese', price: 20 }] }] };
const params = { cartItems: [{ itemId: 'burger', qty: 1 }], menuItems: [item], coupons: [], orderType: 'takeaway', outlet: { gst_percent: 5, platform_fee: 0, delivery_fee_rules: { base_fee: 29, free_above: 299, per_km_above_3km: 8 } } };
test('bill uses menu prices and preserves a zero platform fee', () => {
  const result = price({ ...params, cartItems: [{ itemId: 'burger', qty: 2, variantId: 'double', addonIds: ['cheese'], price: 1 }] });
  assert.equal(result.itemTotal, 340); assert.equal(result.platformFee, 0); assert.equal(result.grandTotal, 357);
});
test('invalid quantities cannot reduce the order total', () => {
  for (const qty of [-1, 0, 1.5, 51, Infinity, NaN]) assert.throws(() => price({ ...params, cartItems: [{ itemId: 'burger', qty }] }), /quantity/);
});
test('unknown or duplicate customisations are rejected', () => {
  assert.throws(() => price({ ...params, cartItems: [{ itemId: 'burger', qty: 1, variantId: 'other' }] }), /variant/);
  for (const addonIds of [['other'], ['cheese', 'cheese']]) assert.throws(() => price({ ...params, cartItems: [{ itemId: 'burger', qty: 1, addonIds }] }), /add-on/);
});
test('expired and future coupons cannot discount an order', () => {
  const coupon = { code: 'SAVE', is_active: true, type: 'flat', value: 80, min_order: 0 };
  for (const dates of [{ ends_at: '2000-01-01' }, { starts_at: '2099-01-01' }]) assert.equal(price({ ...params, coupons: [{ ...coupon, ...dates }], couponCode: 'SAVE' }).discount, 0);
});
test('unavailable items are reported before order creation', () => assert.deepEqual(Array.from(price({ ...params, menuItems: [{ ...item, is_available: false }] }).unavailableItemIds), ['burger']));
