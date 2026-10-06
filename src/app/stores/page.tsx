import Link from "next/link";
import { ArrowRight, Clock, MapPin, Navigation, Phone, ShoppingBag, Truck, Utensils } from "lucide-react";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { BADAGAON_OUTLET, SEED_OUTLET } from "@/lib/seed-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";
import type { Outlet } from "@/types/database";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata("Burger Budds | Stores in Gwalior", "Find Burger Budds stores in Gwalior, view outlet details and get directions.", "/stores");
export default async function StoreLocatorPage() {
  const client = await getSupabaseServerClient();
  let stores: Outlet[] = [SEED_OUTLET, BADAGAON_OUTLET];
  if (client) {
    let { data, error } = await client.from("outlets").select("*").eq("is_active", true).order("name");
    if (error?.code === "42703" && error.message.includes("is_active")) {
      const legacy = await client.from("outlets").select("*").order("name");
      data = legacy.data; error = legacy.error;
    }
    if (error) throw new Error("Unable to load stores.");
    stores = data || [];
  }
  return <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
    <GlobalHeader />
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-extrabold tracking-[0.18em] uppercase text-brand-secondary mb-2">Your neighbourhood burger spot</p><h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Good food. <span className="text-brand-secondary">Closer to you.</span></h1><p className="mt-3 text-text-secondary">Choose your Burger Budds store. Fresh burgers, your way.</p></div>
        <span className="bg-surface-base border border-border-subtle rounded-pill px-4 py-2 text-sm font-bold">{stores.length} stores in Gwalior</span>
      </div>
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
        <div className="space-y-4">{stores.length === 0 && <p>No stores available right now.</p>}{stores.map(store => {
          const open = store.is_open && (!store.pause_until || new Date(store.pause_until).getTime() <= Date.now());
          const maps = store.slug === BADAGAON_OUTLET.slug ? "https://www.google.com/maps/place/Burger+Budds+Badagaon+Restaurant/@26.232214,78.2708995,598m/data=!3m2!1e3!4b1!4m6!3m5!1s0x3976c1005a865fcf:0x7e98a7d5b315009e!8m2!3d26.232214!4d78.2708995!16s%2Fg%2F11vrvbqy0n" : `https://www.google.com/maps/search/?api=1&query=${store.lat},${store.lng}`;
          return <article key={store.id} className="rounded-2xl bg-surface-base border border-border-subtle p-5 sm:p-6 shadow-card transition-shadow hover:shadow-floating motion-reduce:transition-none">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl bg-brand-secondary p-2 flex items-center justify-center"><img src="/logo.png" width={80} height={80} alt="Burger Budds" className="w-full h-full object-contain" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2"><h2 className="text-lg font-extrabold leading-snug">{store.name.replace("Burger Budds — ", "").replace("Burger Budds Badagaon Restaurant", "Badagaon, Gwalior")}</h2><span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-bold ${open ? "bg-status-openSoft text-status-open" : "bg-status-errorSoft text-status-error"}`}><span className="w-1.5 h-1.5 rounded-full bg-current" />{open ? "Open for orders" : "Currently closed"}</span></div>
                <p className="text-sm text-text-secondary flex items-start gap-2"><MapPin className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />{store.address}</p>
                <p className="mt-2 text-sm text-text-secondary flex gap-2"><Clock className="w-4 h-4 shrink-0" aria-hidden="true" />{store.timings?.open && store.timings?.close ? `${store.timings.open} – ${store.timings.close}` : "See store hours on Google Maps"}</p>
                <div className="flex flex-wrap gap-2 mt-3">{store.delivery_enabled !== false && <span className="inline-flex items-center gap-1.5 rounded-pill bg-status-openSoft text-brand-secondary px-2.5 py-1 text-xs font-bold"><Truck className="w-3.5 h-3.5" aria-hidden="true" />Delivery · {store.delivery_radius_km} km</span>}<span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary/15 text-text-primary px-2.5 py-1 text-xs font-bold"><ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />Pickup</span></div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-border-subtle flex flex-wrap items-center gap-2">
              <a href={maps} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${store.name} (opens in new tab)`} className="min-h-[44px] px-3 border border-border-muted rounded-xs inline-flex items-center gap-2 text-sm font-bold text-brand-secondary hover:bg-surface-page"><Navigation className="w-4 h-4" aria-hidden="true" />Directions</a>
              {store.phone && <a href={`tel:${store.phone}`} aria-label={`Call ${store.name}`} className="min-h-[44px] min-w-[44px] border border-border-muted rounded-xs inline-flex justify-center items-center text-brand-secondary hover:bg-surface-page"><Phone className="w-4 h-4" aria-hidden="true" /></a>}
              <Link href={`/order/${store.slug}`} className="sm:ml-auto min-h-[46px] w-full sm:w-auto sm:min-w-[190px] px-5 py-2.5 rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold inline-flex justify-center items-center gap-2">{open ? "Order Online" : "View Menu"}<ArrowRight className="w-4 h-4" aria-hidden="true" /></Link>
            </div>
          </article>;
        })}</div>
        <aside className="rounded-2xl overflow-hidden border border-border-subtle bg-surface-base lg:sticky lg:top-24"><div className="p-5"><h2 className="font-extrabold text-lg">Find us in Gwalior</h2><p className="text-sm text-text-secondary mt-1">A fresh bite is just around the corner.</p></div><iframe title="Burger Budds stores in Gwalior" src="https://maps.google.com/maps?q=Burger%20Budds%20Gwalior&t=&z=12&ie=UTF8&iwloc=&output=embed" className="w-full h-[320px] lg:h-[390px] border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><div className="p-5 flex items-center gap-3"><Utensils className="w-5 h-5 text-brand-secondary" aria-hidden="true" /><p className="text-sm text-text-secondary">Made fresh. Delivered locally.<br /><strong className="text-text-primary">Or swing by for pickup.</strong></p></div></aside>
      </div>
    </main><GlobalFooter />
  </div>;
}
