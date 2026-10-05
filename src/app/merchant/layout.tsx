import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merchant Dashboard | Burger Budds",
  robots: { index: false, follow: false },
};

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
