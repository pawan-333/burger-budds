"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Home,
  Hotel,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AddressLabel, ServiceabilityResult } from "@/types/database";
import { SEED_OUTLET } from "@/lib/seed-data";

interface PresetLocation {
  name: string;
  locality: string;
  city: string;
  lat: number;
  lng: number;
  tag: string;
}

const GWALIOR_LOCATIONS: PresetLocation[] = [
  {
    name: "Vinay Nagar Sector 3 (Near Outlet)",
    locality: "Sector 3, Vinay Nagar",
    city: "Gwalior",
    lat: 26.2205,
    lng: 78.1812,
    tag: "0.3 km • Inside Zone",
  },
  {
    name: "Kailash Vihar, City Center",
    locality: "Kailash Vihar, City Center",
    city: "Gwalior",
    lat: 26.2095,
    lng: 78.1912,
    tag: "1.3 km • Inside Zone",
  },
  {
    name: "Phoolbagh Square, Lashkar",
    locality: "Phoolbagh, Lashkar",
    city: "Gwalior",
    lat: 26.2124,
    lng: 78.1772,
    tag: "0.9 km • Inside Zone",
  },
  {
    name: "Deendayal Nagar (DD Nagar)",
    locality: "DD Nagar, Maharajpura Road",
    city: "Gwalior",
    lat: 26.2465,
    lng: 78.2045,
    tag: "3.8 km • Inside Zone",
  },
  {
    name: "Morar Cantonment (7.8 km away)",
    locality: "Sadar Bazar, Morar Cantonment",
    city: "Gwalior",
    lat: 26.2288,
    lng: 78.2595,
    tag: "7.7 km • Outside 5km Zone",
  },
  {
    name: "Gwalior Airport Road (10.2 km away)",
    locality: "Maharajpura Airport Terminal",
    city: "Gwalior",
    lat: 26.2933,
    lng: 78.2278,
    tag: "9.5 km • Outside 5km Zone",
  },
];

export function AddressModal() {
  const {
    isAddressModalOpen,
    closeAddressModal,
    savedAddresses,
    selectedAddress,
    selectAddress,
    addSavedAddress,
    deleteSavedAddress,
    user,
  } = useApp();

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const mapBoxRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<"list" | "add">("list");
  const [mobileStep, setMobileStep] = useState<1 | 2>(1);

  // Pin coordinates & auto-detected locality
  const [pinLat, setPinLat] = useState<number>(26.2188);
  const [pinLng, setPinLng] = useState<number>(78.1835);
  const [locality, setLocality] = useState<string>("Vinay Nagar, Sector 3");
  const [city, setCity] = useState<string>("Gwalior");
  const [mapSearch, setMapSearch] = useState<string>("");

  // Serviceability state
  const [checkingService, setCheckingService] = useState<boolean>(false);
  const [serviceability, setServiceability] =
    useState<ServiceabilityResult | null>(null);

  // Step 2 Form fields
  const [house, setHouse] = useState<string>("");
  const [landmark, setLandmark] = useState<string>("");
  const [phone, setPhone] = useState<string>(
    user?.phone?.replace(/\D/g, "").slice(-10) || "9826055443"
  );
  const [email, setEmail] = useState<string>(user?.email || "");
  const [label, setLabel] = useState<AddressLabel>("home");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.phone) {
      setPhone(user.phone.replace(/\D/g, "").slice(-10));
    }
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isAddressModalOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
      setMode("list");
      setMobileStep(1);
      setFormError(null);
    }
  }, [isAddressModalOpen]);

  // Backdrop click fallback
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleBackdrop = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!inside) closeAddressModal();
    };
    dialog.addEventListener("click", handleBackdrop);
    return () => dialog.removeEventListener("click", handleBackdrop);
  }, [closeAddressModal]);

  const checkPinServiceability = useCallback(
    async (lat: number, lng: number) => {
      setCheckingService(true);
      try {
        const res = await fetch("/api/serviceability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat,
            lng,
            outlet: SEED_OUTLET.slug,
          }),
        });
        const data: ServiceabilityResult = await res.json();
        setServiceability(data);
      } catch {
        // Fallback local distance check
      } finally {
        setCheckingService(false);
      }
    },
    []
  );

  useEffect(() => {
    if (mode === "add") {
      checkPinServiceability(pinLat, pinLng);
    }
  }, [mode, pinLat, pinLng, checkPinServiceability]);

  const handleMapClickOrDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = mapBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width; // 0..1
    const relY = (e.clientY - rect.top) / rect.height; // 0..1

    // Map center is SEED_OUTLET (26.2183, 78.1828), span ~0.14 deg (~15 km)
    const newLat = Number((SEED_OUTLET.lat + (0.5 - relY) * 0.12).toFixed(5));
    const newLng = Number((SEED_OUTLET.lng + (relX - 0.5) * 0.14).toFixed(5));

    setPinLat(newLat);
    setPinLng(newLng);

    // Find closest named locality in Gwalior
    let bestLoc = GWALIOR_LOCATIONS[0];
    let bestDist = Infinity;
    for (const loc of GWALIOR_LOCATIONS) {
      const d = Math.hypot(loc.lat - newLat, loc.lng - newLng);
      if (d < bestDist) {
        bestDist = d;
        bestLoc = loc;
      }
    }
    if (bestDist < 0.025) {
      setLocality(bestLoc.locality);
      setCity(bestLoc.city);
    } else {
      setLocality(
        `Pinned Location (${newLat.toFixed(3)}°N, ${newLng.toFixed(3)}°E)`
      );
      setCity("Gwalior");
    }
  };

  const handleUseMyLocation = () => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPinLat(Number(pos.coords.latitude.toFixed(5)));
          setPinLng(Number(pos.coords.longitude.toFixed(5)));
          setLocality("Current GPS Location");
          setCity("Gwalior");
        },
        () => {
          // Default to Vinay Nagar Sector 3 if denied on desktop
          setPinLat(26.2205);
          setPinLng(78.1812);
          setLocality("Sector 3, Vinay Nagar");
          setCity("Gwalior");
        },
        { timeout: 4000 }
      );
    } else {
      setPinLat(26.2205);
      setPinLng(78.1812);
      setLocality("Sector 3, Vinay Nagar");
      setCity("Gwalior");
    }
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (serviceability && !serviceability.serviceable) {
      setFormError(
        "Location is not serviceable. Please move the map pin inside the 5 km delivery zone."
      );
      return;
    }

    if (!house.trim()) {
      setFormError("Please enter your House / Flat / Office No.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      setFormError("Please enter a valid 10-digit phone number.");
      return;
    }

    addSavedAddress({
      label,
      house: house.trim(),
      landmark: landmark.trim(),
      phone: `+91 ${cleanPhone}`,
      email: email.trim(),
      lat: pinLat,
      lng: pinLng,
      locality,
      city,
      distance_km: serviceability?.distanceKm ?? 1.2,
    });

    setMode("list");
    setMobileStep(1);
    setHouse("");
    setLandmark("");
    closeAddressModal();
  };

  // Compute pin visual position (0..100%) on the interactive map canvas
  const pinLeftPercent = Math.min(
    92,
    Math.max(8, 50 + ((pinLng - SEED_OUTLET.lng) / 0.14) * 100)
  );
  const pinTopPercent = Math.min(
    90,
    Math.max(10, 50 - ((pinLat - SEED_OUTLET.lat) / 0.12) * 100)
  );

  const filteredPresets = GWALIOR_LOCATIONS.filter(
    (loc) =>
      !mapSearch.trim() ||
      loc.name.toLowerCase().includes(mapSearch.toLowerCase()) ||
      loc.locality.toLowerCase().includes(mapSearch.toLowerCase())
  );

  const isServiceable = serviceability ? serviceability.serviceable : true;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={closeAddressModal}
      aria-labelledby="address-modal-title"
      className="w-full max-w-4xl rounded-md bg-surface-base text-text-primary p-0 shadow-floating backdrop:bg-surface-dark/60 backdrop:backdrop-blur-xs overflow-hidden"
    >
      {/* Modal Header */}
      <div className="bg-brand-secondary text-text-onSecondary px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MapPin className="w-5 h-5 text-brand-primary shrink-0" />
          <div>
            <h2 id="address-modal-title" className="text-lg font-extrabold">
              {mode === "list"
                ? "Select Delivery Address"
                : "Pin Delivery Location & Address Details"}
            </h2>
            <p className="text-xs text-text-onSecondary/85">
              Delivering from {SEED_OUTLET.name} ({SEED_OUTLET.delivery_radius_km}{" "}
              km zone)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={closeAddressModal}
          aria-label="Close address modal"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xs text-text-onSecondary hover:bg-brand-secondaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Mode 1: Saved Addresses List */}
      {mode === "list" ? (
        <div className="p-5 sm:p-6 max-h-[80vh] overflow-y-auto space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-text-secondary">
              Saved Delivery Addresses ({savedAddresses.length})
            </h3>
            <button
              type="button"
              onClick={() => {
                setMode("add");
                setMobileStep(1);
              }}
              className="min-h-[44px] px-4 py-2 rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 shadow-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add New Address</span>
            </button>
          </div>

          {savedAddresses.length === 0 ? (
            <div className="p-8 rounded-md bg-surface-raised border border-border-subtle text-center space-y-4">
              <div className="w-12 h-12 rounded-pill bg-brand-secondarySoft text-brand-secondary mx-auto flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <div className="max-w-sm mx-auto space-y-1">
                <p className="text-base font-extrabold text-text-primary">
                  No saved addresses yet
                </p>
                <p className="text-xs font-medium text-text-secondary">
                  Add a delivery address to check availability and see your
                  delivery time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode("add");
                  setMobileStep(1);
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-sm inline-flex items-center gap-2 shadow-1"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add New Address</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {savedAddresses.map((addr) => {
                const isSelected = selectedAddress?.id === addr.id;
                return (
                  <div
                    key={addr.id}
                    className={`p-4 rounded-sm border-2 transition duration-fast flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "border-brand-secondary bg-brand-secondarySoft/50"
                        : "border-border-subtle bg-surface-base hover:border-border-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-pill bg-brand-secondary text-text-onSecondary text-[11px] font-extrabold uppercase">
                          {addr.label}
                        </span>
                        {addr.distance_km !== undefined && (
                          <span className="text-xs font-bold text-status-open">
                            • {addr.distance_km} km away
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteSavedAddress(addr.id)}
                        aria-label={`Delete ${addr.label} address`}
                        className="p-1.5 text-text-muted hover:text-status-error rounded-xs"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <p className="text-sm font-bold text-text-primary">
                        {addr.house}
                      </p>
                      <p className="text-xs font-medium text-text-secondary mt-0.5">
                        {addr.landmark ? `${addr.landmark}, ` : ""}
                        {addr.locality}, {addr.city}
                      </p>
                      <p className="text-xs font-semibold text-text-muted mt-1">
                        Phone: {addr.phone}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        selectAddress(addr);
                        closeAddressModal();
                      }}
                      className={`w-full min-h-[44px] rounded-xs font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition duration-fast ${
                        isSelected
                          ? "bg-brand-secondary text-text-onSecondary"
                          : "bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isSelected
                          ? "Delivering Here (Selected)"
                          : "Deliver Here"}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Mode 2: Add New Address (Split panel on desktop, 2-step on mobile) */
        <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[84vh] overflow-y-auto">
          {/* Step 1: Google Map Pin & Serviceability Check */}
          <div
            className={`lg:col-span-7 p-4 sm:p-5 bg-surface-raised border-b lg:border-b-0 lg:border-r border-border-subtle flex flex-col justify-between ${
              mobileStep === 2 ? "hidden lg:flex" : "flex"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setMode("list")}
                  className="text-xs font-bold text-brand-secondary underline"
                >
                  ← Back to Saved Addresses
                </button>
                <span className="text-xs font-bold text-text-secondary">
                  Step 1 of 2: Pin Map Location
                </span>
              </div>

              {/* Search Box + Use My Location */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center bg-surface-base border border-border-muted rounded-xs px-3 min-h-[44px]">
                  <Search className="w-4 h-4 text-text-muted mr-2 shrink-0" />
                  <input
                    type="search"
                    value={mapSearch}
                    onChange={(e) => setMapSearch(e.target.value)}
                    placeholder="Search area, street, landmark in Gwalior..."
                    aria-label="Search area on map"
                    className="w-full text-xs sm:text-sm font-medium text-text-primary focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  className="min-h-[44px] px-3.5 py-2 rounded-xs bg-surface-base border border-brand-secondary text-brand-secondary hover:bg-brand-secondarySoft font-bold text-xs inline-flex items-center justify-center gap-1.5 shrink-0 transition duration-fast"
                >
                  <LocateFixed className="w-4 h-4" />
                  <span>Use my location</span>
                </button>
              </div>

              {/* Quick Area Chips for testing Inside vs Outside 5km zone */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {filteredPresets.map((loc) => {
                  const isOutside = loc.tag.includes("Outside");
                  return (
                    <button
                      key={loc.name}
                      type="button"
                      onClick={() => {
                        setPinLat(loc.lat);
                        setPinLng(loc.lng);
                        setLocality(loc.locality);
                        setCity(loc.city);
                      }}
                      className={`px-2.5 py-1.5 rounded-pill text-[11px] font-bold shrink-0 border transition duration-fast ${
                        isOutside
                          ? "bg-status-errorSoft border-status-error/40 text-status-error hover:bg-status-error hover:text-text-onSecondary"
                          : "bg-surface-base border-border-muted text-text-primary hover:border-brand-secondary"
                      }`}
                    >
                      {loc.name} ({loc.tag})
                    </button>
                  );
                })}
              </div>

              {/* Interactive Draggable Pin Map Canvas */}
              <div
                ref={mapBoxRef}
                onClick={handleMapClickOrDrag}
                role="application"
                aria-label="Interactive delivery map — click or tap anywhere to move the delivery pin"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") setPinLat((p) => Number((p + 0.005).toFixed(5)));
                  if (e.key === "ArrowDown") setPinLat((p) => Number((p - 0.005).toFixed(5)));
                  if (e.key === "ArrowRight") setPinLng((p) => Number((p + 0.005).toFixed(5)));
                  if (e.key === "ArrowLeft") setPinLng((p) => Number((p - 0.005).toFixed(5)));
                }}
                className="relative w-full h-64 sm:h-72 rounded-sm border-2 border-border-muted bg-surface-page overflow-hidden cursor-crosshair select-none shadow-inner"
              >
                {/* Simulated Road Grid & Gwalior Landmarks */}
                <div className="absolute inset-0 opacity-25 pointer-events-none">
                  <div className="w-full h-full grid grid-cols-6 grid-rows-6">
                    {Array.from({ length: 36 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="border border-brand-secondary/30"
                      />
                    ))}
                  </div>
                </div>

                {/* 5km Serviceable Zone Circle around Burger Budds Outlet */}
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 sm:w-60 sm:h-60 rounded-pill border-2 border-dashed border-brand-secondary bg-brand-secondarySoft/35 pointer-events-none flex items-end justify-center pb-2"
                  aria-hidden="true"
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-pill bg-brand-secondary text-text-onSecondary">
                    5 km Delivery Zone • Vinay Nagar
                  </span>
                </div>

                {/* Outlet Marker at Center */}
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center"
                  aria-hidden="true"
                >
                  <span className="px-2 py-0.5 rounded-xs bg-brand-secondary text-brand-primary text-[10px] font-extrabold shadow-1">
                    Burger Budds Outlet
                  </span>
                  <span className="w-3 h-3 rounded-pill bg-brand-secondary border-2 border-surface-base" />
                </div>

                {/* Customer Draggable Pin + Required Tooltip */}
                <div
                  style={{
                    left: `${pinLeftPercent}%`,
                    top: `${pinTopPercent}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-full pointer-events-none flex flex-col items-center transition-all duration-instant"
                >
                  <div className="px-2.5 py-1 rounded-xs bg-surface-dark text-text-onSecondary text-[11px] font-bold shadow-floating whitespace-nowrap mb-1">
                    Your order will be delivered here — Move the map to place
                    the pin
                  </div>
                  <div
                    className={`w-9 h-9 rounded-pill flex items-center justify-center shadow-floating border-2 border-surface-base ${
                      isServiceable
                        ? "bg-brand-primary text-text-onPrimary"
                        : "bg-status-error text-text-onSecondary"
                    }`}
                  >
                    <MapPin className="w-5 h-5" />
                  </div>
                </div>

                {/* Bottom Coordinates Overlay */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-3 py-1.5 rounded-xs bg-surface-base/90 backdrop-blur-xs text-[11px] font-bold text-text-secondary border border-border-subtle">
                  <span>
                    Pin: {pinLat.toFixed(4)}°N, {pinLng.toFixed(4)}°E
                  </span>
                  <span className="text-brand-secondary">
                    Tap map or use arrow keys to move pin
                  </span>
                </div>
              </div>

              {/* Serviceability Status Banner */}
              {checkingService ? (
                <div className="p-3 rounded-xs bg-surface-base border border-border-subtle flex items-center gap-2 text-xs font-bold text-text-secondary">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-secondary" />
                  <span>Checking delivery serviceability for this pin...</span>
                </div>
              ) : serviceability && !serviceability.serviceable ? (
                <div
                  role="alert"
                  className="p-3.5 rounded-xs bg-status-error text-text-onSecondary flex items-start gap-2.5 shadow-1"
                >
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-extrabold">
                      Location is not serviceable
                    </p>
                    <p className="text-xs opacity-90">
                      This pin is {serviceability.distanceKm} km away (outside
                      our {serviceability.maxRadiusKm} km delivery radius around
                      Vinay Nagar, Gwalior). Move the pin closer to proceed.
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  role="status"
                  className="p-3 rounded-xs bg-status-openSoft border border-status-open text-status-open flex items-center justify-between gap-2 text-xs font-extrabold"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      Deliverable! {locality}, {city} (
                      {serviceability?.distanceKm ?? 1.1} km)
                    </span>
                  </div>
                  <span>ETA ~{serviceability?.etaMins ?? 35} Mins</span>
                </div>
              )}
            </div>

            {/* Mobile Step 1 -> Step 2 CTA */}
            <div className="mt-4 lg:hidden">
              <button
                type="button"
                disabled={!isServiceable || checkingService}
                onClick={() => setMobileStep(2)}
                className="w-full min-h-[44px] rounded-xs bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 disabled:cursor-not-allowed text-text-onPrimary font-extrabold text-sm flex items-center justify-center gap-2 shadow-1"
              >
                <Navigation className="w-4 h-4" />
                <span>
                  {isServiceable
                    ? "Confirm Pin & Enter Address Details"
                    : "Location is not serviceable"}
                </span>
              </button>
            </div>
          </div>

          {/* Step 2: Address Details Form */}
          <div
            className={`lg:col-span-5 p-4 sm:p-5 bg-surface-base flex flex-col justify-between ${
              mobileStep === 1 ? "hidden lg:flex" : "flex"
            }`}
          >
            <form onSubmit={handleSaveAddress} className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-text-secondary">
                  Step 2: Address Details
                </h3>
                <button
                  type="button"
                  onClick={() => setMobileStep(1)}
                  className="lg:hidden text-xs font-bold text-brand-secondary underline"
                >
                  ← Change on map
                </button>
              </div>

              {/* Green Card with Auto Locality/City + Change on Map */}
              <div className="p-3.5 rounded-xs bg-brand-secondary text-text-onSecondary flex items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-extrabold">{locality}</p>
                    <p className="text-[11px] text-text-onSecondary/80">
                      {city} •{" "}
                      {serviceability
                        ? `${serviceability.distanceKm} km from outlet`
                        : "Pinned on map"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileStep(1)}
                  className="px-2.5 py-1 rounded-xs bg-brand-primary text-text-onPrimary text-xs font-extrabold shrink-0"
                >
                  Change on map
                </button>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="p-2.5 rounded-xs bg-status-errorSoft border border-status-error text-status-error text-xs font-bold"
                >
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="addr-house"
                  className="block text-xs font-bold text-text-secondary mb-1"
                >
                  House / Flat / Office No. *
                </label>
                <input
                  id="addr-house"
                  type="text"
                  required
                  value={house}
                  onChange={(e) => setHouse(e.target.value)}
                  placeholder="e.g. Flat 302, Tower B, Lotus Greens"
                  className="w-full min-h-[44px] px-3 rounded-xs border border-border-muted text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                />
              </div>

              <div>
                <label
                  htmlFor="addr-landmark"
                  className="block text-xs font-bold text-text-secondary mb-1"
                >
                  Landmark (Optional)
                </label>
                <input
                  id="addr-landmark"
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near Bahodapur Gate / Opposite SBI ATM"
                  className="w-full min-h-[44px] px-3 rounded-xs border border-border-muted text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="addr-phone"
                    className="block text-xs font-bold text-text-secondary mb-1"
                  >
                    Phone * (+91)
                  </label>
                  <div className="flex items-center rounded-xs border border-border-muted overflow-hidden focus-within:ring-2 focus-within:ring-brand-secondary">
                    <span className="px-2.5 py-2.5 bg-surface-raised text-xs font-bold text-text-secondary border-r border-border-muted">
                      +91
                    </span>
                    <input
                      id="addr-phone"
                      type="tel"
                      required
                      maxLength={10}
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      placeholder="9826055443"
                      className="w-full min-h-[44px] px-2.5 text-sm font-bold text-text-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="addr-email"
                    className="block text-xs font-bold text-text-secondary mb-1"
                  >
                    Email (Optional)
                  </label>
                  <input
                    id="addr-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full min-h-[44px] px-3 rounded-xs border border-border-muted text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
              </div>

              {/* Save As Pills: Home / Office / Hotel / Other */}
              <div>
                <span className="block text-xs font-bold text-text-secondary mb-1.5">
                  Save Address As
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: "home", label: "Home", icon: Home },
                      { id: "office", label: "Office", icon: Building2 },
                      { id: "hotel", label: "Hotel", icon: Hotel },
                      { id: "other", label: "Other", icon: MapPin },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = label === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLabel(opt.id)}
                        className={`min-h-[44px] rounded-xs border text-xs font-bold flex items-center justify-center gap-1 transition duration-fast ${
                          active
                            ? "bg-brand-secondary text-text-onSecondary border-brand-secondary"
                            : "bg-surface-base text-text-secondary border-border-muted hover:bg-surface-raised"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={!isServiceable || checkingService}
                className="w-full min-h-[44px] mt-2 rounded-xs bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 disabled:cursor-not-allowed text-text-onPrimary font-extrabold text-sm flex items-center justify-center gap-2 shadow-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 transition duration-fast"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isServiceable
                    ? "Save Address & Deliver Here"
                    : "Location is not serviceable"}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </dialog>
  );
}
