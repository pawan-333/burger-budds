import { NextRequest,NextResponse } from 'next/server';
import {authorize} from '@/lib/access';
export async function GET(){const a=await authorize(undefined,true);if(!a)return NextResponse.json({error:'Brand access required'},{status:403});const {data,error}=await a.client.from('menu_items').select('*').order('name');return NextResponse.json(error?{error:'Catalog unavailable'}:{items:data},{status:error?500:200});}
export async function POST(req:NextRequest){
 const a=await authorize(undefined,true);if(!a)return NextResponse.json({error:'Brand access required'},{status:403});
 try{const b=await req.json();
 if(b.action==='publish') {if(typeof b.itemId!=='string'||(b.outletIds!==null&&!Array.isArray(b.outletIds)))throw Error();
 const {data,error}=await a.client.rpc('publish_menu_item',{target_item:b.itemId,target_outlets:b.outletIds});if(error)throw error;return NextResponse.json({ok:true,published:data});}
 if(typeof b.name!=='string'||!b.name.trim()||!Number.isFinite(b.price)||b.price<0||!['veg','nonveg','egg'].includes(b.diet))throw Error();
 const item={name:b.name.trim(),description:String(b.description||'').slice(0,3000),price:b.price,diet:b.diet,category_name:String(b.category_name||'Menu'),image_url:String(b.image_url||'/menu-fallback.svg'),is_bestseller:b.is_bestseller===true,is_new:b.is_new===true};
 const query=b.id?a.client.from('menu_items').update(item).eq('id',b.id):a.client.from('menu_items').insert(item);const {data,error}=await query.select().single();if(error)throw error;return NextResponse.json({item:data});
 }catch{return NextResponse.json({error:'Invalid catalog request'},{status:400});}
}
