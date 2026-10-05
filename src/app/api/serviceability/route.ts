import { NextRequest, NextResponse } from "next/server";
import {
  computeDistanceKm,
  getMenuBundle,
  isPointInPolygon,
} from "@/lib/server-db";
import { ServiceabilityResult } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const outletSlug = body.outlet || body.outletSlug;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json(
        { error: "Valid latitude and longitude are required" },
        { status: 400 }
      );
    }

    const { outlet } = await getMenuBundle(outletSlug);
    const distanceKm = computeDistanceKm(outlet.lat, outlet.lng, lat, lng);
    const maxRadiusKm = Number(outlet.delivery_radius_km) || 5.0;

    let serviceable = distanceKm <= maxRadiusKm;
    if (outlet.delivery_polygon && outlet.delivery_polygon.length >= 3) {
      serviceable = isPointInPolygon(lat, lng, outlet.delivery_polygon);
    }

    if (outlet.delivery_enabled === false) {
      serviceable = false;
    }

    const rules = outlet.delivery_fee_rules || {
      base_fee: 29,
      free_above: 299,
      per_km_above_3km: 8,
    };
    let deliveryFee = rules.base_fee;
    if (distanceKm > 3) {
      deliveryFee += Math.ceil(distanceKm - 3) * rules.per_km_above_3km;
    }

    const etaMins = Math.max(
      25,
      (outlet.prep_time_min || 30) + Math.round(distanceKm * 4)
    );

    const result: ServiceabilityResult = {
      serviceable,
      distanceKm,
      maxRadiusKm,
      etaMins,
      deliveryFee,
      outletName: outlet.name,
      area: outlet.area,
      message: serviceable
        ? `Delivering in ~${etaMins} mins (${distanceKm} km from ${outlet.area})`
        : "Location is not serviceable — outside our 5 km delivery zone around Vinay Nagar, Gwalior.",
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Serviceability check error:", err);
    return NextResponse.json(
      { error: "Failed to check serviceability" },
      { status: 500 }
    );
  }
}
