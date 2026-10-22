import { getVerifiedUser } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/server-db';
export async function authorize(outletId?: string, brandOnly = false) {
 const user=await getVerifiedUser(); if(!user) return null;
 const client=getSupabaseAdminClient(); if(!client) return null;
 const {data:admin}=await client.from('super_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 const {data:brand}=await client.from('brand_memberships').select('user_id').eq('user_id',user.id).maybeSingle();
 if(admin || brand) return {client,user,brand:true};
 if(brandOnly || !outletId) return null;
 const {data:member}=await client.from('outlet_memberships').select('role').eq('user_id',user.id).eq('outlet_id',outletId).maybeSingle();
 const {data:legacy}=await client.from('staff').select('role').eq('user_id',user.id).eq('outlet_id',outletId).maybeSingle();
 return member || legacy ? {client,user,brand:false} : null;
}
