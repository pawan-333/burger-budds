import {
  BillBreakdown,
  Coupon,
  MenuItem,
  OrderType,
  Outlet,
} from "@/types/database";

export interface ServerCartItemInput {
  itemId: string;
  variantId?: string | null;
  addonIds?: string[];
  qty: number;
}

export function computeServerBill(params: {
  cartItems: ServerCartItemInput[];
  menuItems: MenuItem[];
  outlet: Outlet;
  coupons: Coupon[];
  orderType: OrderType;
  couponCode?: string | null;
  useWallet?: boolean;
  walletBalance?: number;
  distanceKm?: number;
}): BillBreakdown {
  const {
    cartItems,
    menuItems,
    outlet,
    coupons,
    orderType,
    couponCode,
    useWallet = false,
    walletBalance = 0,
    distanceKm = 1.8,
  } = params;

  let itemTotal = 0;
  const unavailableItemIds: string[] = [];

  for (const line of cartItems) {
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 50) throw new Error("Invalid cart quantity.");
    const dbItem = menuItems.find((m) => m.id === line.itemId);
    if (!dbItem) {
      unavailableItemIds.push(line.itemId);
      continue;
    }
    if (!dbItem.is_available) {
      unavailableItemIds.push(dbItem.id);
    }

    let unitPrice = Number(dbItem.price);

    if (line.variantId) {
      const foundVariant = dbItem.variants?.find((v) => v.id === line.variantId);
      if (!foundVariant) throw new Error("Invalid item variant.");
      unitPrice += Number(foundVariant.price_delta);
    }

    if (line.addonIds?.length) {
      if (new Set(line.addonIds).size !== line.addonIds.length) throw new Error("Duplicate add-ons.");
      const allAddons = dbItem.addon_groups?.flatMap((g) => g.addons || []) || [];
      for (const addonId of line.addonIds) {
        const foundAddon = allAddons.find((a) => a.id === addonId);
        if (!foundAddon) throw new Error("Invalid item add-on.");
        unitPrice += Number(foundAddon.price);
      }
    }
    for (const group of dbItem.addon_groups || []) {
      const count = (line.addonIds || []).filter((id) => group.addons.some((addon) => addon.id === id)).length;
      if (count < group.min_select || count > group.max_select) throw new Error("Please review required add-ons.");
    }

    itemTotal += unitPrice * line.qty;
  }

  if (itemTotal === 0) {
    return {
      itemTotal: 0,
      gstPercent: outlet.gst_percent,
      tax: 0,
      deliveryFee: 0,
      platformFee: 0,
      discount: 0,
      couponCode: null,
      couponMessage: null,
      walletUsed: 0,
      grandTotal: 0,
      unavailableItemIds,
    };
  }

  // Coupon validation
  let discount = 0;
  let appliedCode: string | null = null;
  let couponMessage: string | null = null;

  if (couponCode && couponCode.trim().length > 0) {
    const normalized = couponCode.trim().toUpperCase();
    const coupon = coupons.find(
      (c) => c.code.toUpperCase() === normalized && c.is_active &&
        (!c.starts_at || new Date(c.starts_at).getTime() <= Date.now()) &&
        (!c.ends_at || new Date(c.ends_at).getTime() > Date.now())
    );
    if (!coupon) {
      couponMessage = `Coupon "${normalized}" is invalid or expired.`;
    } else if (itemTotal < coupon.min_order) {
      const diff = Math.ceil(coupon.min_order - itemTotal);
      couponMessage = `Add items worth ₹${diff} more to apply ${coupon.code}`;
    } else {
      appliedCode = coupon.code;
      if (coupon.type === "flat") {
        discount = Math.min(coupon.value, itemTotal);
      } else if (coupon.type === "percent") {
        const raw = Math.round((itemTotal * coupon.value) / 100);
        discount = coupon.max_discount ? Math.min(raw, coupon.max_discount) : raw;
      }
      couponMessage = `Coupon ${coupon.code} applied! You saved ₹${discount}`;
    }
  }

  const taxableAmount = Math.max(0, itemTotal - discount);
  const gstPercent = Number(outlet.gst_percent ?? 5);
  const tax = Math.round((taxableAmount * gstPercent) / 100);

  let deliveryFee = 0;
  if (orderType === "delivery") {
    const rules = outlet.delivery_fee_rules || {
      base_fee: 29,
      free_above: 299,
      per_km_above_3km: 8,
    };
    if (itemTotal >= rules.free_above) {
      deliveryFee = 0;
    } else {
      deliveryFee = rules.base_fee;
      if (distanceKm > 3) {
        deliveryFee += Math.ceil(distanceKm - 3) * rules.per_km_above_3km;
      }
    }
  }

  const platformFee = Number(outlet.platform_fee ?? 9);
  const preWalletTotal = Math.max(
    0,
    itemTotal - discount + tax + deliveryFee + platformFee
  );

  const maxWalletAllowed = Math.min(walletBalance, preWalletTotal);
  const walletUsed = useWallet ? Math.round(maxWalletAllowed) : 0;

  const grandTotal = Math.max(0, Math.round(preWalletTotal - walletUsed));

  return {
    itemTotal,
    gstPercent,
    tax,
    deliveryFee,
    platformFee,
    discount,
    couponCode: appliedCode,
    couponMessage,
    walletUsed,
    grandTotal,
    unavailableItemIds,
  };
}
