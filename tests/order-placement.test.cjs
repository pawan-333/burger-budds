const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');

function load(file, modules={}) {
  const scope={exports:{},process,console:{error:()=>{}},require:name=>{
    if (name in modules) return modules[name];
    throw new Error('Unexpected dependency: '+name);
  }};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,scope);
  return scope.exports;
}
const pricing=load('src/lib/pricing.ts');
function route({walletError=true,balance=80,price=139,rpcError=false}={}) {
  const walletCalls=[],writes=[];
  const outlet={id:'test-outlet',slug:'test-outlet',name:'Test outlet',lat:26,lng:78,min_order:0,gst_percent:5,platform_fee:9,prep_time_min:25,delivery_radius_km:6,delivery_enabled:true,delivery_fee_rules:{base_fee:29,free_above:349,per_km_above_3km:0}};
  const item={id:'test-burger',name:'Test burger',price,is_available:true,diet:'veg',variants:[],addon_groups:[]};
  const db={rpc:async(name,args)=>{assert.equal(name,'create_order_atomic');writes.push(args);return rpcError?{data:null,error:new Error('Database unavailable')}:{data:args.order_payload,error:null};}};
  const modules={
    'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status||200})}},
    crypto:require('node:crypto'),
    '@/lib/server-db':{getSupabaseAdminClient:()=>db,getInitialStore:()=>({orders:[],idempotencyKeys:{}}),getMenuBundle:async()=>({outlet,items:[item],coupons:[]}),computeDistanceKm:()=>4.5,isPointInPolygon:()=>true},
    '@/lib/pricing':pricing,
    '@/lib/supabase/server':{getVerifiedUser:async()=>({id:'verified-test-user'}),getSupabaseServerClient:async()=>db},
    '@/lib/guest-session':{getGuestOrderHash:async()=>null,publicOrder:({guest_session_hash,...order})=>order},
    '@/lib/site-access':{PUBLIC_MERCHANT_ACCESS:false},
    '@/lib/outlet-hours':{outletHours:()=>({open:true})},
    '@/lib/wallet':{walletAvailable:async id=>{walletCalls.push(id);if(walletError)throw Error('Wallet unavailable');return balance;}},
  };
  const order=load('src/app/api/orders/route.ts',modules);
  const cart=load('src/app/api/cart/price/route.ts',modules);
  const body={outletSlug:outlet.slug,orderType:'delivery',paymentMethod:'cod',useWallet:false,idempotencyKey:'test-request',address:{lat:26,lng:78,house:'Test unit',phone:'9000000000'},items:[{itemId:item.id,qty:3}]};
  return {post:patch=>order.POST({json:async()=>({...body,...patch})}),quote:patch=>cart.POST({json:async()=>({...body,...patch})}),walletCalls,writes};
}

test('COD succeeds without wallet tables when coins are off, with correct 417 bill',async()=>{
  const r=route();const result=await r.post();
  assert.equal(result.status,201);assert.equal(r.walletCalls.length,0);assert.equal(r.writes.length,1);
  assert.equal(result.data.order.item_total,417);assert.equal(result.data.order.delivery_fee,0);assert.equal(result.data.order.wallet_used,0);assert.equal(result.data.order.grand_total,447);
});
test('below 349 remains flat 29 even beyond 3km',async()=>{
  const r=route();const result=await r.post({items:[{itemId:'test-burger',qty:2}]});
  assert.equal(result.status,201);assert.equal(result.data.order.delivery_fee,29);assert.equal(result.data.order.grand_total,330);
});
test('exactly 349 receives free delivery',async()=>{
  const result=await route({price:349}).post({items:[{itemId:'test-burger',qty:1}]});
  assert.equal(result.status,201);assert.equal(result.data.order.delivery_fee,0);
});
test('requested coins still fail closed when wallet verification is unavailable',async()=>{
  const r=route();const result=await r.post({useWallet:true});
  assert.equal(result.status,500);assert.equal(r.walletCalls[0],'verified-test-user');assert.equal(r.writes.length,0);
});
test('requested coins use verified balance rather than client-supplied balance',async()=>{
  const r=route({walletError:false});const result=await r.post({useWallet:true,walletBalance:99999});
  assert.equal(result.status,201);assert.equal(result.data.order.wallet_used,80);assert.equal(result.data.order.grand_total,367);
});
test('takeaway without coins does not depend on the wallet',async()=>{
  const r=route();const result=await r.post({orderType:'takeaway',customerPhone:'9000000000',useWallet:undefined});
  assert.equal(result.status,201);assert.equal(r.walletCalls.length,0);assert.equal(result.data.order.delivery_fee,0);
});
test('quote and order both skip unavailable wallet when coins are not requested',async()=>{
  const r=route();const quote=await r.quote();const placed=await r.post();
  assert.equal(quote.status,200);assert.equal(quote.data.grandTotal,placed.data.order.grand_total);assert.equal(r.walletCalls.length,0);
});
test('database order failure never returns a successful order',async()=>{
  const result=await route({rpcError:true}).post();assert.equal(result.status,500);
});
