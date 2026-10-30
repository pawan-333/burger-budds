import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rider Dashboard | Burger Budds",
  robots: { index: false, follow: false },
};

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
