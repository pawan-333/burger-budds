export interface CollectionDetails {
  payment_method?: string;
  payment_status?: string;
  collection_method?: "cash" | "upi_delivery" | null;
  collected_at?: string | null;
  collected_by?: string | null;
  collection_reference?: string | null;
}

export function collectionLabel(order: CollectionDetails): string {
  if (order.payment_status === "refunded") return "Payment refunded";
  if (order.collection_method === "cash") return "Cash at delivery · rider confirmed";
  if (order.collection_method === "upi_delivery") return "UPI at delivery · verified";
  if (order.payment_status === "paid") return order.payment_method === "cod" ? "Paid · collection source unavailable" : "Online prepaid · verified";
  return order.payment_method === "cod" ? "Collect on delivery" : "Online payment pending";
}
