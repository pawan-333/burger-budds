import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/access';
import { getMenuBundle } from '@/lib/server-db';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest) {
 try{return NextResponse.json(await getMenuBundle(req.nextUrl.searchParams.get('outlet') || undefined));}
 catch{return NextResponse.json({error:'Menu unavailable. Choose another outlet.'},{status:404});}
}
export async function PATCH(req:NextRequest) {
 try {
 const body=await req.json(); const {outlet}=await getMenuBundle(body.outletSlug);
 const access=await authorize(outlet.id); if(!access)return NextResponse.json({error:'Staff access required.'},{status:403});
 const {client}=access;
 if(body.action==='update_outlet') {
 const patch:Record<string,unknown>={};
 if(typeof body.is_open==='boolean')patch.is_open=body.is_open;
 if(typeof body.delivery_enabled==='boolean')patch.delivery_enabled=body.delivery_enabled;
 if(Number.isInteger(body.prep_time_min)&&body.prep_time_min>0&&body.prep_time_min<=120)patch.prep_time_min=body.prep_time_min;
 if(Number.isInteger(body.pause_minutes)&&body.pause_minutes>=0&&body.pause_minutes<=1440)patch.pause_until=body.pause_minutes?new Date(Date.now()+body.pause_minutes*60000).toISOString():null;
 if(!Object.keys(patch).length)throw Error('Invalid update');
 const {data,error}=await client.from('outlets').update(patch).eq('id',outlet.id).select().single();if(error)throw error;
 return NextResponse.json({ok:true,outlet:data});
 }
 if(body.action==='update_item'||body.action==='toggle_category_stock') {
 const {data:targets,error:lookup}=await (body.action==='update_item'?client.from('items').select('id').eq('id',body.itemId):client.from('items').select('id').eq('category_id',body.categoryId)).eq('outlet_id',outlet.id);
 if(lookup||!targets?.length)throw Error('Item not in outlet');
 const patch:Record<string,unknown>={};if(typeof body.is_available==='boolean')patch.available=body.is_available;
 if(body.price!==undefined) {
 if(!access.brand&&!outlet.allow_price_override)return NextResponse.json({error:'Brand permission required for price changes.'},{status:403});
 if(!Number.isFinite(body.price)||body.price<0||body.price>100000)throw Error('Invalid price');patch.price_override=body.price;
 }
 if(!Object.keys(patch).length)throw Error('Invalid item update');
 const {error}=await client.from('outlet_menu_items').update(patch).eq('outlet_id',outlet.id).in('legacy_item_id',targets.map(i=>i.id));if(error)throw error;
 // Compatibility projection for historical menu subscribers.
 const legacy:Record<string,unknown>={};if(patch.available!==undefined)legacy.is_available=patch.available;if(patch.price_override!==undefined)legacy.price=patch.price_override;
 const {error:projection}=await client.from('items').update(legacy).eq('outlet_id',outlet.id).in('id',targets.map(i=>i.id));if(projection)throw projection;
 return NextResponse.json({ok:true});
 }
 return NextResponse.json({error:'Unknown action'},{status:400});
 } catch{return NextResponse.json({error:'Unable to update. Check outlet and migration setup.'},{status:400});}
}
