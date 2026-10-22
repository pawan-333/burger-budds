import {NextRequest,NextResponse} from 'next/server';
import {computeDistanceKm,getMenuBundle,listOutlets} from '@/lib/server-db';
import {outletHours} from '@/lib/outlet-hours';
export async function POST(req:NextRequest){try{
 const b=await req.json();const {lat,lng}=b;
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return NextResponse.json({error:'Valid coordinates required'},{status:400});
 const stores=b.outlet||b.outletSlug?[(await getMenuBundle(b.outlet||b.outletSlug)).outlet]:await listOutlets();
 const ranked=stores.map(outlet=>({outlet,distanceKm:computeDistanceKm(outlet.lat,outlet.lng,lat,lng)})).sort((a,b)=>a.distanceKm-b.distanceKm);
 const chosen=ranked.find(s=>s.distanceKm<=s.outlet.delivery_radius_km&&s.outlet.delivery_enabled!==false&&outletHours(s.outlet).open)||ranked[0];
 if(!chosen)return NextResponse.json({serviceable:false,message:'No outlet found. Explore pickup menus.'});
 const {outlet,distanceKm}=chosen;const rules=outlet.delivery_fee_rules;
 const serviceable=distanceKm<=outlet.delivery_radius_km&&outlet.delivery_enabled!==false&&outletHours(outlet).open;
 return NextResponse.json({serviceable,outlet,distanceKm,maxRadiusKm:outlet.delivery_radius_km,etaMins:outlet.prep_time_min+Math.ceil(distanceKm*4),deliveryFee:rules.base_fee+Math.max(0,Math.ceil(distanceKm-3))*rules.per_km_above_3km,outletName:outlet.name,area:outlet.area,message:serviceable?'Delivery available':'No outlet found for delivery. Explore Menu or choose pickup.'});
 }catch{return NextResponse.json({error:'Unable to check delivery area'},{status:503});}}
