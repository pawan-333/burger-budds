import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { OtpAuthModal } from "@/components/modals/OtpAuthModal";
import { AddressModal } from "@/components/modals/AddressModal";
import { ProfileDrawer } from "@/components/modals/ProfileDrawer";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Burger Budds — Online Ordering | Fresh Smash Burgers in Gwalior",
  description:
    "Order handcrafted smash burgers, crispy paneer burgers, peri-peri crinkle fries, and thick shakes online from Burger Budds Vinay Nagar, Gwalior.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className="font-sans bg-surface-page text-text-primary min-h-screen">
        <AppProvider>
          {children}
          <OtpAuthModal />
          <AddressModal />
          <ProfileDrawer />
        </AppProvider>
      </body>
    </html>
  );
}
