import type {MetadataRoute} from 'next';
import {PUBLIC_PATHS,SITE_URL} from '@/lib/seo';
import {listOutlets} from '@/lib/server-db';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const stores=await listOutlets();return [...PUBLIC_PATHS,...stores.map(s=>'/order/'+s.slug)].map(p=>({url:SITE_URL+p}));}
