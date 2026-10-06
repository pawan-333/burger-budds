"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Address,
  CartAddonSelection,
  CartLineItem,
  ItemVariant,
  MenuItem,
  OrderType,
  Outlet,
  UserProfile,
} from "@/types/database";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { verifyEmailOtp } from "@/lib/supabase/email-auth";

import { SEED_OUTLET } from "@/lib/seed-data";
interface AddToCartInput {
  item: MenuItem;
  variant?: ItemVariant | null;
  addons?: CartAddonSelection[];
  qty?: number;
  note?: string;
}

interface AppContextValue {
  activeOutlet: Outlet;
  selectOutlet: (outlet: Outlet) => void;
  cartId: string;
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  cartItems: CartLineItem[];
  addToCart: (input: AddToCartInput) => void;
  updateLineQty: (cartItemId: string, delta: number) => void;
  updateSimpleItemQty: (item: MenuItem, delta: number) => void;
  getItemQtyInCart: (itemId: string) => number;
  clearCart: () => void;
  totalItemsCount: number;
  cartSubtotal: number;
  specialInstructions: string;
  setSpecialInstructions: (val: string) => void;
  couponCode: string | null;
  setCouponCode: (code: string | null) => void;
  useWallet: boolean;
  setUseWallet: (use: boolean) => void;
  marketingOptIn: boolean;
  setMarketingOptIn: (val: boolean) => void;

  // Auth & Profile
  user: UserProfile | null;
  isAuthModalOpen: boolean;
  openAuthModal: (onSuccessCallback?: () => void) => void;
  closeAuthModal: () => void;
  sendPhoneOtp: (phone: string) => Promise<{ ok: boolean; message: string }>;
  verifyPhoneOtp: (
    phone: string,
    otp: string,
    name?: string
  ) => Promise<{ ok: boolean; message: string }>;
  updateUserProfile: (patch: Partial<UserProfile>) => void;
  logout: () => void;

  // Profile Drawer
  isProfileOpen: boolean;
  profileSection: string;
  openProfile: (section?: string) => void;
  closeProfile: () => void;

  // Addresses
  savedAddresses: Address[];
  selectedAddress: Address | null;
  selectAddress: (addr: Address) => void;
  addSavedAddress: (addr: Omit<Address, "id" | "user_id">) => Promise<Address>;
  deleteSavedAddress: (id: string) => Promise<void>;
  isAddressModalOpen: boolean;
  openAddressModal: () => void;
  closeAddressModal: () => void;

  // Global menu search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Cross-tab realtime notifier
  notifyRealtimeUpdate: (type: "order_created" | "order_updated" | "menu_updated", payload?: unknown) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const STORAGE_KEYS = {
  CART: "bb_cart_v1",
  USER: "bb_user_v1",
  ADDRESSES: "bb_addresses_v1",
  SELECTED_ADDR: "bb_selected_address_v1",
};

const DEFAULT_SAVED_ADDRESSES: Address[] = [
  {
    id: "addr-seed-1",
    user_id: "user-local-1",
    label: "home",
    house: "Flat 204, Emerald Residency, Sector 3, Vinay Nagar",
    landmark: "Near Bahodapur Square",
    phone: "+91 98260 55443",
    email: "buddy@burgerbudds.in",
    lat: 26.2215,
    lng: 78.1795,
    locality: "Vinay Nagar, Gwalior",
    city: "Gwalior",
    distance_km: 0.6,
  },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeOutlet, setActiveOutlet] = useState<Outlet>(SEED_OUTLET);
  const [cartId, setCartId] = useState<string>("bb-cart-live");
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState<string>("");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [useWallet, setUseWallet] = useState<boolean>(false);
  const [marketingOptIn, setMarketingOptIn] = useState<boolean>(false);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authCallback, setAuthCallback] = useState<(() => void) | null>(null);

  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [profileSection, setProfileSection] = useState<string>("overview");

  const [savedAddresses, setSavedAddresses] = useState<Address[]>(
    []
  );
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hydrated, setHydrated] = useState<boolean>(false);
  const selectOutlet = useCallback((next: Outlet) => {
    if (!hydrated) return;
    if (activeOutlet.id !== next.id) { setCartItems([]); setCouponCode(null); setSpecialInstructions(""); }
    setActiveOutlet(previous => previous.id === next.id ? previous : next);
  }, [activeOutlet.id, hydrated]);

  useEffect(() => {
    try {
      const rawCart = localStorage.getItem(STORAGE_KEYS.CART);
      if (rawCart) {
        const parsed = JSON.parse(rawCart);
        if (parsed.activeOutlet?.slug) setActiveOutlet(parsed.activeOutlet);
        if (parsed.cartId) setCartId(parsed.cartId);
        if (Array.isArray(parsed.cartItems)) setCartItems(parsed.cartItems);
        if (parsed.orderType) setOrderType(parsed.orderType);
        if (parsed.couponCode) setCouponCode(parsed.couponCode);
        if (parsed.specialInstructions)
          setSpecialInstructions(parsed.specialInstructions);
      } else {
        setCartId(`cart-${Math.random().toString(36).slice(2, 9)}`);
      }

      const rawUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (rawUser && !getSupabaseBrowserClient() && process.env.NODE_ENV !== "production") {
        setUser(JSON.parse(rawUser));
      }

      const rawAddresses = localStorage.getItem(STORAGE_KEYS.ADDRESSES);
      if (rawAddresses) {
        const list = JSON.parse(rawAddresses);
        if (Array.isArray(list)) setSavedAddresses(getSupabaseBrowserClient() ? list.filter((address) => address.user_id === "guest-user") : list);
      }

      const rawSelectedAddr = localStorage.getItem(STORAGE_KEYS.SELECTED_ADDR);
      if (rawSelectedAddr) {
        const address = JSON.parse(rawSelectedAddr);
        if (!getSupabaseBrowserClient() || address.user_id === "guest-user") setSelectedAddress(address);
      }
    } catch {
      // Ignore storage errors
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    let active = true;
    const syncUser = async () => {
      const { data } = await sb.auth.getUser();
      if (!active) return;
      if (!data.user) { setUser(null); setSavedAddresses((previous) => previous.filter((address) => address.user_id === "guest-user")); setSelectedAddress((previous) => previous?.user_id === "guest-user" ? previous : null); return; }
      const { data: profile } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      if (active) setUser({
        id: data.user.id,
        name: profile?.name || data.user.user_metadata?.name || "Burger Budds Customer",
        phone: data.user.phone || "",
        email: data.user.email || "",
        wallet_balance: Number(profile?.wallet_balance || 0),
        referral_code: profile?.referral_code || "",
      });
      const { data: addresses } = await sb.from("addresses").select("*").eq("user_id", data.user.id).order("created_at", { ascending: false });
      if (active) {
        setSavedAddresses(addresses || []);
        setSelectedAddress((previous) => previous?.user_id === "guest-user" ? previous : (addresses || []).find((address) => address.id === previous?.id) || null);
      }
    };
    void syncUser();
    const { data: subscription } = sb.auth.onAuthStateChange(() => { setTimeout(() => void syncUser(), 0); });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEYS.CART,
        JSON.stringify({
          activeOutlet,
          cartId,
          orderType,
          cartItems,
          couponCode,
          specialInstructions,
        })
      );
    } catch {
      // Ignore
    }
  }, [activeOutlet, cartId, orderType, cartItems, couponCode, specialInstructions, hydrated]);

  const notifyRealtimeUpdate = useCallback(
    (
      type: "order_created" | "order_updated" | "menu_updated",
      payload?: unknown
    ) => {
      if (typeof window === "undefined") return;
      try {
        const channel = new BroadcastChannel("burger-budds-realtime");
        channel.postMessage({ type, payload, timestamp: Date.now() });
        channel.close();
      } catch {
        // Fallback for environments without BroadcastChannel
      }
    },
    []
  );

  const addToCart = useCallback((input: AddToCartInput) => {
    const { item, variant = null, addons = [], qty = 1, note = "" } = input;
    const sortedAddonKey = addons
      .map((a) => a.id)
      .sort()
      .join(",");
    const compositeKey = `${item.id}__${variant?.id || "base"}__${sortedAddonKey}`;

    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (line) => line.cartItemId === compositeKey
      );
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: updated[existingIdx].qty + qty,
        };
        return updated;
      }
      return [
        ...prev,
        {
          cartItemId: compositeKey,
          itemId: item.id,
          name: item.name,
          image_url: item.image_url,
          diet: item.diet,
          basePrice: Number(item.price),
          variant: variant
            ? {
                id: variant.id,
                name: variant.name,
                price_delta: Number(variant.price_delta),
              }
            : null,
          addons,
          qty,
          note,
        },
      ];
    });
  }, []);

  const updateLineQty = useCallback((cartItemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((line) =>
          line.cartItemId === cartItemId
            ? { ...line, qty: line.qty + delta }
            : line
        )
        .filter((line) => line.qty > 0)
    );
  }, []);

  const updateSimpleItemQty = useCallback((item: MenuItem, delta: number) => {
    setCartItems((prev) => {
      const matchingLines = prev.filter((l) => l.itemId === item.id);
      if (matchingLines.length === 0 && delta > 0) {
        const defaultVariant = item.variants?.[0] || null;
        const compositeKey = `${item.id}__${defaultVariant?.id || "base"}__`;
        return [
          ...prev,
          {
            cartItemId: compositeKey,
            itemId: item.id,
            name: item.name,
            image_url: item.image_url,
            diet: item.diet,
            basePrice: Number(item.price),
            variant: defaultVariant
              ? {
                  id: defaultVariant.id,
                  name: defaultVariant.name,
                  price_delta: Number(defaultVariant.price_delta),
                }
              : null,
            addons: [],
            qty: 1,
          },
        ];
      }
      if (matchingLines.length > 0) {
        const targetId =
          matchingLines[matchingLines.length - 1].cartItemId;
        return prev
          .map((line) =>
            line.cartItemId === targetId
              ? { ...line, qty: line.qty + delta }
              : line
          )
          .filter((line) => line.qty > 0);
      }
      return prev;
    });
  }, []);

  const getItemQtyInCart = useCallback(
    (itemId: string) => {
      return cartItems
        .filter((l) => l.itemId === itemId)
        .reduce((sum, l) => sum + l.qty, 0);
    },
    [cartItems]
  );

  const clearCart = useCallback(() => {
    setCartItems([]);
    setCouponCode(null);
    setUseWallet(false);
    setSpecialInstructions("");
  }, []);

  const totalItemsCount = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.qty, 0),
    [cartItems]
  );

  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((acc, line) => {
      const variantExtra = line.variant?.price_delta || 0;
      const addonsExtra = line.addons.reduce((s, a) => s + a.price, 0);
      return acc + (line.basePrice + variantExtra + addonsExtra) * line.qty;
    }, 0);
  }, [cartItems]);

  const openAuthModal = useCallback((cb?: () => void) => {
    if (cb) setAuthCallback(() => cb);
    else setAuthCallback(null);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setAuthCallback(null);
  }, []);

  const sendPhoneOtp = useCallback(async (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return {
        ok: false,
        message: "Please enter a valid 10-digit mobile number.",
      };
    }
    const formatted = `+91${cleanPhone}`;
    const sb = getSupabaseBrowserClient();
    if (sb) {
      try {
        const { error } = await sb.auth.signInWithOtp({ phone: formatted });
        if (!error) {
          return {
            ok: true,
            message: `OTP sent to ${formatted} via SMS.`,
          };
        }
        return { ok: false, message: error.message };
      } catch {
        return { ok: false, message: "Could not send OTP. Please try again." };
      }
    }
    if (process.env.NODE_ENV === "production") {
      return { ok: false, message: "Phone login is not configured yet. Please contact the store." };
    }
    return {
      ok: true,
      message: `OTP sent to +91 ${cleanPhone} (Use demo OTP: 123456)`,
    };
  }, []);

  const verifyPhoneOtp = useCallback(
    async (phone: string, otp: string, name?: string) => {
      if (phone.includes("@")) {
        const result = await verifyEmailOtp(phone, otp);
        if (!result.ok || !result.user) return { ok: false, message: result.message };
        const profile: UserProfile = {
          id: result.user.id, name: name?.trim() || "Burger Budds Customer",
          phone: result.user.phone || "", email: result.user.email || phone,
          wallet_balance: 0, referral_code: "",
        };
        setUser(profile);
        const sb = getSupabaseBrowserClient();
        await sb?.from("profiles").update({ name: profile.name }).eq("id", profile.id);
        setIsAuthModalOpen(false);
        if (authCallback) authCallback();
        return { ok: true, message: "Signed in!" };
      }
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);
      const formatted = `+91 ${cleanPhone}`;
      const sb = getSupabaseBrowserClient();
      if (sb) {
        try {
          const { data, error } = await sb.auth.verifyOtp({
            phone: `+91${cleanPhone}`,
            token: otp.trim(),
            type: "sms",
          });
          if (!error && data.user) {
            const profile: UserProfile = {
              id: data.user.id,
              name: name?.trim() || "Burger Budds Fan",
              phone: formatted,
              email: data.user.email || "",
              wallet_balance: 0,
              referral_code: `BB${cleanPhone.slice(-4)}`,
            };
            setUser(profile);
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(profile));
            setIsAuthModalOpen(false);
            if (authCallback) authCallback();
            return { ok: true, message: "Logged in!" };
          }
          return { ok: false, message: error?.message || "Invalid OTP. Please try again." };
        } catch {
          return { ok: false, message: "Could not verify OTP. Please try again." };
        }
      }

      if (process.env.NODE_ENV === "production") {
        return { ok: false, message: "Phone login is not configured yet." };
      }
      if (otp.trim() !== "123456") {
        return {
          ok: false,
          message: "Please enter the 6-digit OTP (e.g. 123456).",
        };
      }

      const profile: UserProfile = {
        id: `user-${cleanPhone}`,
        name: name?.trim() || "Aditya Verma",
        phone: formatted,
        email: "aditya@burgerbudds.in",
        wallet_balance: 150,
        referral_code: `BUDDS${cleanPhone.slice(-4)}`,
      };
      setUser(profile);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(profile));
      setIsAuthModalOpen(false);
      if (authCallback) authCallback();
      return { ok: true, message: "Verified!" };
    },
    [authCallback]
  );

  const updateUserProfile = useCallback((patch: Partial<UserProfile>) => {
    const sb = getSupabaseBrowserClient();
    if (sb) {
      void sb.auth.getUser().then(({ data }) => {
        if (data.user) void sb.from("profiles").update({ name: patch.name, email: patch.email, phone: patch.phone }).eq("id", data.user.id);
      });
    }
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const logout = useCallback(() => {
    const sb = getSupabaseBrowserClient();
    if (sb) {
      sb.auth.signOut().catch(() => {});
    }
    setUser(null);
    setSavedAddresses([]);
    setSelectedAddress(null);
    localStorage.removeItem(STORAGE_KEYS.ADDRESSES);
    localStorage.removeItem(STORAGE_KEYS.SELECTED_ADDR);
    setIsProfileOpen(false);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }, []);

  const openProfile = useCallback((section = "overview") => {
    setProfileSection(section);
    setIsProfileOpen(true);
  }, []);

  const closeProfile = useCallback(() => {
    setIsProfileOpen(false);
  }, []);

  const selectAddress = useCallback((addr: Address) => {
    setSelectedAddress(addr);
    localStorage.setItem(STORAGE_KEYS.SELECTED_ADDR, JSON.stringify(addr));
  }, []);

  const addSavedAddress = useCallback(
    async (addr: Omit<Address, "id" | "user_id">): Promise<Address> => {
      let created: Address = {
        ...addr,
        id: crypto.randomUUID(),
        user_id: user?.id || "guest-user",
      };
      const sb = getSupabaseBrowserClient();
      if (sb && user) {
        const { distance_km, ...persisted } = created;
        const { data, error } = await sb.from("addresses").insert(persisted).select().single();
        if (error) throw new Error("Could not save your address. Please try again.");
        created = { ...data, distance_km };
      }
      setSavedAddresses((prev) => {
        const next = [created, ...prev];
        localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(next));
        return next;
      });
      selectAddress(created);
      return created;
    },
    [user, selectAddress]
  );

  const deleteSavedAddress = useCallback(async (id: string) => {
    const sb = getSupabaseBrowserClient();
    if (sb) {
      const { error } = await sb.from("addresses").delete().eq("id", id);
      if (error) throw new Error("Could not remove the address. Please try again.");
    }
    setSavedAddresses((prev) => {
      const next = prev.filter((a) => a.id !== id);
      localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(next));
      return next;
    });
    setSelectedAddress((prev) => {
      if (prev?.id === id) {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_ADDR);
        return null;
      }
      return prev;
    });
  }, []);

  const openAddressModal = useCallback(() => setIsAddressModalOpen(true), []);
  const closeAddressModal = useCallback(() => setIsAddressModalOpen(false), []);

  const value = useMemo<AppContextValue>(
    () => ({
      activeOutlet, selectOutlet,
      cartId,
      orderType,
      setOrderType,
      cartItems,
      addToCart,
      updateLineQty,
      updateSimpleItemQty,
      getItemQtyInCart,
      clearCart,
      totalItemsCount,
      cartSubtotal,
      specialInstructions,
      setSpecialInstructions,
      couponCode,
      setCouponCode,
      useWallet,
      setUseWallet,
      marketingOptIn,
      setMarketingOptIn,
      user,
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
      sendPhoneOtp,
      verifyPhoneOtp,
      updateUserProfile,
      logout,
      isProfileOpen,
      profileSection,
      openProfile,
      closeProfile,
      savedAddresses,
      selectedAddress,
      selectAddress,
      addSavedAddress,
      deleteSavedAddress,
      isAddressModalOpen,
      openAddressModal,
      closeAddressModal,
      searchQuery,
      setSearchQuery,
      notifyRealtimeUpdate,
    }),
    [
      activeOutlet, selectOutlet,
      cartId,
      orderType,
      cartItems,
      addToCart,
      updateLineQty,
      updateSimpleItemQty,
      getItemQtyInCart,
      clearCart,
      totalItemsCount,
      cartSubtotal,
      specialInstructions,
      couponCode,
      useWallet,
      marketingOptIn,
      user,
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
      sendPhoneOtp,
      verifyPhoneOtp,
      updateUserProfile,
      logout,
      isProfileOpen,
      profileSection,
      openProfile,
      closeProfile,
      savedAddresses,
      selectedAddress,
      selectAddress,
      addSavedAddress,
      deleteSavedAddress,
      isAddressModalOpen,
      openAddressModal,
      closeAddressModal,
      searchQuery,
      notifyRealtimeUpdate,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return ctx;
}
