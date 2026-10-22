import type { Outlet } from '@/types/database';
function minutes(value: string): number | null {
 const match = value?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
 if (!match) return null;
 let hour = Number(match[1]); const minute = Number(match[2]);
 if (minute > 59 || hour > 23) return null;
 if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
 return hour * 60 + minute;
}
export function outletHours(outlet: Outlet, now = new Date()) {
 const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const part = (type: string) => parts.find(p=>p.type===type)?.value || '';
 const day = part('weekday').toLowerCase();
 const configured = outlet.opening_hours && Object.keys(outlet.opening_hours).length > 0;
 const hours = configured ? outlet.opening_hours?.[day] : outlet.timings;
 const current = Number(part('hour'))*60 + Number(part('minute'));
 const start=minutes(hours?.open || ''),end=minutes(hours?.close || '');
 let scheduled = start !== null && end !== null && (start === end || (start < end ? current >= start && current < end : current >= start));
 // Overnight service before midnight belongs to yesterday's schedule.
 const yesterday = ['sun','mon','tue','wed','thu','fri','sat'][ (['sun','mon','tue','wed','thu','fri','sat'].indexOf(day)+6)%7 ];
 const previous = configured ? outlet.opening_hours?.[yesterday] : outlet.timings;
 const ps=minutes(previous?.open || ''),pe=minutes(previous?.close || '');
 if (ps !== null && pe !== null && ps > pe && current < pe) scheduled=true;
 const paused=outlet.pause_until && Date.parse(outlet.pause_until)>now.getTime();
 const open=outlet.is_open && outlet.status!=='paused' && !paused && scheduled;
 return {open, label:open ? 'Closes at '+hours?.close : 'Opens at '+(hours?.open || 'hours to be confirmed'), hours};
}
