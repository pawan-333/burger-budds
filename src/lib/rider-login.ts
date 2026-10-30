import { parseRiderDetails } from "@/lib/order-rider";

// Phone Auth is disabled in this project. Dedicated, admin-provisioned rider
// identities use the existing password provider; no email delivery is involved.
export function riderLoginIdentity(mobile: string) {
  const phone = parseRiderDetails("Rider", mobile)?.phone;
  return phone ? { phone, email: `rider-${phone.slice(1)}@riders.burgerbudds.invalid` } : null;
}
