export type DietType = "veg" | "nonveg" | "egg";
export type OrderType = "delivery" | "takeaway";
export type AddressLabel = "home" | "office" | "hotel" | "other";
export type OrderStatus =
  | "placed"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "rejected"
  | "cancelled";

export type PaymentMethod = "razorpay" | "cod";
export type StaffRole = "owner" | "manager" | "staff";

export interface DeliveryFeeRules {
  base_fee: number;
  free_above: number;
  per_km_above_3km: number;
}

export interface Outlet {
  id: string;
  slug: string;
  name: string;
  address: string;
  area: string;
  lat: number;
  lng: number;
  phone: string;
  is_open: boolean;
  prep_time_min: number;
  delivery_radius_km: number;
  delivery_polygon: Array<[number, number]> | null;
  min_order: number;
  gst_percent: number;
  platform_fee: number;
  delivery_fee_rules: DeliveryFeeRules;
  timings: {
    open: string;
    close: string;
  };
  pause_until?: string | null;
  delivery_enabled?: boolean;
}

export interface Category {
  id: string;
  outlet_id: string;
  name: string;
  sort_order: number;
  parent_id: string | null;
  is_active: boolean;
}

export interface ItemVariant {
  id: string;
  item_id: string;
  name: string;
  price_delta: number;
}

export interface Addon {
  id: string;
  group_id: string;
  name: string;
  price: number;
  diet: DietType;
}

export interface AddonGroup {
  id: string;
  item_id: string;
  name: string;
  min_select: number;
  max_select: number;
  addons: Addon[];
}

export interface MenuItem {
  id: string;
  outlet_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  original_price: number | null;
  image_url: string;
  diet: DietType;
  is_available: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  is_on_offer: boolean;
  rating: number;
  order_count: number;
  sort_order: number;
  variants?: ItemVariant[];
  addon_groups?: AddonGroup[];
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string;
  type: "flat" | "percent" | "fixed_price";
  value: number;
  min_order: number;
  max_discount: number | null;
  first_order_only: boolean;
  starts_at?: string;
  ends_at?: string;
  usage_limit?: number;
  is_active: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  wallet_balance: number;
  referral_code: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: AddressLabel;
  house: string;
  landmark: string;
  phone: string;
  email: string;
  lat: number;
  lng: number;
  locality: string;
  city: string;
  distance_km?: number;
}

export interface CartAddonSelection {
  id: string;
  name: string;
  price: number;
}

export interface CartLineItem {
  cartItemId: string;
  itemId: string;
  name: string;
  image_url: string;
  diet: DietType;
  basePrice: number;
  variant?: {
    id: string;
    name: string;
    price_delta: number;
  } | null;
  addons: CartAddonSelection[];
  qty: number;
  note?: string;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  distanceKm: number;
  maxRadiusKm: number;
  etaMins: number;
  deliveryFee: number;
  outletName: string;
  area: string;
  message: string;
}

export interface BillBreakdown {
  itemTotal: number;
  gstPercent: number;
  tax: number;
  deliveryFee: number;
  platformFee: number;
  discount: number;
  couponCode: string | null;
  couponMessage: string | null;
  walletUsed: number;
  grandTotal: number;
  unavailableItemIds: string[];
}

export interface OrderItemRecord {
  id: string;
  order_id: string;
  item_id: string;
  item_name: string;
  diet: DietType;
  variant: string | null;
  addons: CartAddonSelection[];
  qty: number;
  unit_price: number;
}

export interface OrderEventRecord {
  id: string;
  order_id: string;
  status: OrderStatus;
  actor: string;
  note?: string | null;
  created_at: string;
}

export interface OrderRecord {
  id: string;
  order_no: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string;
  outlet_id: string;
  order_type: OrderType;
  address_snapshot: Address | null;
  status: OrderStatus;
  reject_reason: string | null;
  item_total: number;
  tax: number;
  delivery_fee: number;
  platform_fee: number;
  discount: number;
  wallet_used: number;
  grand_total: number;
  coupon_code: string | null;
  payment_method: PaymentMethod;
  payment_status: "pending" | "paid" | "refunded" | "failed";
  razorpay_order_id: string | null;
  special_instructions: string;
  marketing_opt_in: boolean;
  prep_time_min: number;
  rider_id: string | null;
  rider_name?: string;
  rider_phone?: string;
  placed_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  items: OrderItemRecord[];
  events: OrderEventRecord[];
}
