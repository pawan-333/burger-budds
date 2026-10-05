"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";

export default function DeliveryMap({ lat, lng, outletLat, outletLng, radiusKm, onSelect }: {
  lat: number; lng: number; outletLat: number; outletLng: number; radiusKm: number;
  onSelect: (lat: number, lng: number) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  useEffect(() => {
    if (!element.current) return;
    const instance = L.map(element.current).setView([lat, lng], 14);
    map.current = instance;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(instance);
    L.circle([outletLat, outletLng], { radius: radiusKm * 1000 }).addTo(instance);
    L.circleMarker([outletLat, outletLng], { radius: 7 }).bindTooltip("Burger Budds outlet").addTo(instance);
    const marker = L.marker([lat, lng], {
      draggable: true,
      icon: L.divIcon({ html: '<span style="font-size:28px;color:#4c6d3e">●</span>', className: "delivery-pin", iconSize: [28, 36], iconAnchor: [14, 28] }),
    }).addTo(instance).bindTooltip("Delivery location");
    pin.current = marker;
    marker.on("dragend", () => { const point = marker.getLatLng(); onSelectRef.current(point.lat, point.lng); });
    instance.on("click", (event: L.LeafletMouseEvent) => { onSelectRef.current(event.latlng.lat, event.latlng.lng); });
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(element.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; pin.current = null; };
    // The map instance lives for this mounted dialog panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletLat, outletLng, radiusKm]);
  useEffect(() => { pin.current?.setLatLng([lat, lng]); map.current?.panTo([lat, lng]); }, [lat, lng]);
  return <div className="space-y-2">
    <div ref={element} role="region" aria-label="Delivery map. Tap a location or drag the delivery marker." className="h-72 w-full rounded-sm border border-border-muted relative z-0" />
    <p className="text-xs text-text-secondary">Tap the map or drag the marker. Location: {lat.toFixed(5)}, {lng.toFixed(5)}.</p>
    <div className="flex gap-2 flex-wrap" aria-label="Adjust delivery pin">
      {([["North", 0.0005, 0], ["South", -0.0005, 0], ["East", 0, 0.0005], ["West", 0, -0.0005]] as const).map(([label, dLat, dLng]) => <button key={label} type="button" className="min-h-[44px] px-3 border border-border-muted rounded-xs" onClick={() => onSelect(lat + dLat, lng + dLng)}>Move {label.toLowerCase()}</button>)}
    </div>
  </div>;
}
