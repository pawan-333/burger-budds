const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const catalog = require('../src/lib/data/badagaon-menu.json');
const scope = { exports: {}, require };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/pricing.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, scope);

test('Badagaon paneer and large choices charge the PDF price at checkout', () => {
  const choices = [
    ['Chilli Lava Burger', 'Paneer', 159],
    ['Maharaja Burger', 'Paneer', 199],
    ['Maxi Maharaja Feast Burger', 'Paneer', 229],
    ['Regular Fries', 'Large', 129],
    ['Cheesy Loaded Fries', 'Large', 159],
    ['Momos Burger', 'Paneer', 109],
  ];
  for (const [name, variantName, expected] of choices) {
    const item = catalog.items.find(row => row.name === name);
    assert(item, name);
    const variant = item.variants.find(row => row.name === variantName);
    assert(variant, variantName);
    const bill = scope.exports.computeServerBill({ cartItems: [{ itemId: item.id, variantId: variant.id, qty: 1 }], menuItems: catalog.items, coupons: [], orderType: 'takeaway', outlet: { gst_percent: 0, platform_fee: 0, delivery_fee_rules: { base_fee: 0, free_above: 0, per_km_above_3km: 0 } } });
    assert.equal(bill.itemTotal, expected, `${name}: ${variantName}`);
  }
});

test('new catalog contains every PDF category without copied demo meals or invented offers', () => {
  assert.equal(catalog.items.length, 83);
  assert.equal(catalog.categories.length, 16);
  assert.equal(catalog.items.flatMap(row => row.variants).length, 38);
  const categoryIds = new Set(catalog.categories.map(row => row.id));
  assert.equal(new Set(catalog.items.map(row => row.id)).size, 83);
  for (const item of catalog.items) {
    assert(categoryIds.has(item.category_id));
    assert.equal(item.outlet_id, '11111111-1111-1111-1111-111111111102');
    assert.equal(item.diet, 'veg');
    assert.equal(item.is_on_offer, false);
    assert.equal(item.rating, 0);
    assert(item.description.length > 10);
    assert(!/chicken|smash|combo|truffle/i.test(item.name));
  }
});
