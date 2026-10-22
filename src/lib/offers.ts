import type {Coupon} from '@/types/database';
export function offerText(c:Coupon){const saving=c.type==='flat'?'Save ₹'+c.value:c.type==='percent'?'Save '+c.value+'%'+(c.max_discount?' up to ₹'+c.max_discount:''):'Pay ₹'+c.value;return saving+' on orders from ₹'+c.min_order+(c.first_order_only?' · First order':'')+' · '+c.code;}
