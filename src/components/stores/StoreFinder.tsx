'use client';
import {useEffect,useRef,useState} from 'react';
import {getCurrentLocation} from '@/lib/geolocation';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {useApp} from '@/context/AppContext';
import type {Outlet} from '@/types/database';
export function StoreFinder(){
 const locationRequest=useRef<AbortController|null>(null);
 const [locating,setLocating]=useState(false);
 useEffect(()=>()=>locationRequest.current?.abort(),[]);
 const router=useRouter();const {savedAddresses,selectOutlet,selectAddress}=useApp();
 const [query,setQuery]=useState(''),[message,setMessage]=useState(''),[found,setFound]=useState<Outlet|null>(null),[count,setCount]=useState(3),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!found)return;const t=setTimeout(()=>{if(count<=1){selectOutlet(found);router.push('/order/'+found.slug);}else setCount(count-1);},1000);return()=>clearTimeout(t);},[found,count,router,selectOutlet]);
 async function locate(lat:number,lng:number){setBusy(true);setFound(null);try{const r=await fetch('/api/serviceability',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat,lng})});const d=await r.json();setMessage(d.message||d.error);if(d.serviceable){setCount(3);setFound(d.outlet);}}catch{setMessage('Unable to check location. Try again.');}finally{setBusy(false);}}
 async function useCurrentLocation(){
 if(locationRequest.current)return;
 const controller=new AbortController();locationRequest.current=controller;
 setLocating(true);setBusy(true);setMessage('');setFound(null);
 try{const point=await getCurrentLocation(controller.signal);if(!controller.signal.aborted)await locate(point.lat,point.lng);}
 catch(error){if(!controller.signal.aborted)setMessage(error instanceof Error?error.message:'Could not find your location. Please retry.');}
 finally{if(locationRequest.current===controller){locationRequest.current=null;setLocating(false);setBusy(false);}}
 }
 async function search(){setBusy(true);try{const r=await fetch('/api/locations?q='+encodeURIComponent(query));const d=await r.json();if(d.location)await locate(d.location.lat,d.location.lng);else setMessage(d.error||'No location found. Use GPS or pin your address.');}finally{setBusy(false);}}
 return <section className="max-w-2xl mx-auto p-6 rounded-2xl border border-border-subtle bg-surface-base space-y-4"><h1 className="text-3xl font-extrabold">Find a store near you</h1><p>Fresh Burger Budds, from your nearest available outlet.</p><button disabled={busy} className="min-h-11 px-5 rounded-md bg-brand-primary font-bold" aria-busy={locating} onClick={()=>void useCurrentLocation()}>{locating?'Finding your location…':'Use current location'}</button><form onSubmit={e=>{e.preventDefault();void search();}} className="flex gap-2"><label className="flex-1">Pincode or locality<input required value={query} onChange={e=>setQuery(e.target.value)} className="block w-full p-3 border rounded-md" /></label><button disabled={busy} className="px-4 font-bold">Find store</button></form>{savedAddresses.map(a=><button key={a.id} className="block w-full p-3 text-left border rounded-md" onClick={()=>{selectAddress(a);void locate(a.lat,a.lng);}}>{a.label}: {a.house}, {a.locality}</button>)}<p role="status">{locating?'Finding your location…':busy?'Checking delivery area…':message}</p>{found&&<p>Opening {found.name} in {count} seconds. <button onClick={()=>setFound(null)} className="underline">Cancel</button></p>}<Link className="inline-block underline min-h-11" href="/stores">Explore Menu · Pickup · Store Locator</Link></section>;
}
