const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(linkError){
 const outlet={id:'outlet-a',slug:'store-a'};
 const item={id:'item-a',outlet_id:outlet.id,category_id:'category-a',name:'Legacy Burger',price:99};
 const calls=[];
 const client={from(table){const query={select:()=>query,eq:(column,value)=>{calls.push({table,column,value});return query;},order:()=>query,single:async()=>({data:outlet}),then(resolve,reject){const result=table==='categories'?{data:[{id:'category-a',is_active:true}]}:table==='items'?{data:[item]}:table==='coupons'?{data:[]}:table==='outlet_menu_items'?{data:linkError?null:[{legacy_item_id:item.id,central:{name:'Central Burger',price:109,variants:[],addon_groups:[]},available:true}],error:linkError}:{};return Promise.resolve(result).then(resolve,reject);}};return query;}};
 const modules={'@supabase/supabase-js':{createClient:()=>client},ws:class WebSocket{},'@/lib/supabase/client':{isSupabaseConfigured:()=>true},'@/lib/seed-data':{SEED_OUTLET:outlet,SEED_CATEGORIES:[],SEED_ITEMS:[],SEED_COUPONS:[],SEED_ORDERS:[]},'@/lib/data/badagaon-menu.json':{}};
 const scope={exports:{},require:n=>n in modules?modules[n]:require(n),process,structuredClone,console};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/server-db.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,scope);
 return {get:()=>scope.exports.getMenuBundle(outlet.slug),calls};
}
test('missing catalog during migration serves the existing outlet-scoped menu',async()=>{const route=load({code:'PGRST205',message:"Could not find the table 'public.outlet_menu_items' in the schema cache"});const result=await route.get();assert.equal(result.items[0].name,'Legacy Burger');for(const table of ['categories','items','outlet_menu_items'])assert.ok(route.calls.some(c=>c.table===table&&c.column==='outlet_id'&&c.value==='outlet-a'));});
test('migrated catalog overrides legacy content',async()=>{const result=await load(null).get();assert.equal(result.items[0].name,'Central Burger');assert.equal(result.items[0].price,109);});
test('permission failures do not silently fall back',async()=>{await assert.rejects(load({code:'42501',message:'permission denied for table outlet_menu_items'}).get(),e=>e.message.includes('permission denied')&&e.code==='42501');});
test('unrelated missing tables do not silently fall back',async()=>{await assert.rejects(load({code:'PGRST205',message:"Could not find table public.other"}).get(),e=>e.code==='PGRST205');});
