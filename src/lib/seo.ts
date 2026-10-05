import type { Metadata } from "next";

export const SITE_URL = "https://www.burgerbudds.in";
export const HOME_TITLE = "Burger Budds | Burgers, Fast Food & Online Ordering in Gwalior";
export const HOME_DESCRIPTION = "Order burgers, fast food, crispy fries and thick shakes from Burger Budds in Gwalior. Explore our menu and enjoy convenient online ordering for delivery or takeaway.";

export function pageMetadata(title: string, description: string, path: string): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, type: "website", siteName: "Burger Budds",
      locale: "en_IN",
      images: [{ url: `${SITE_URL}/logo.png`, alt: "Burger Budds logo" }],
    },
    twitter: {
      card: "summary", title, description,
      images: [`${SITE_URL}/logo.png`],
    },
  };
}

export const PUBLIC_PATHS = ["/", "/about", "/stores", "/gallery", "/faqs", "/terms", "/privacy", "/refund-policy"];

// Seed contact details are sample data; publish only established brand facts.
export const brandStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization", "@id": `${SITE_URL}/#organization`,
      name: "Burger Budds", url: `${SITE_URL}/`, logo: `${SITE_URL}/logo.png`,
    },
    {
      "@type": "WebSite", "@id": `${SITE_URL}/#website`,
      name: "Burger Budds", url: `${SITE_URL}/`, inLanguage: "en-IN",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Restaurant", "@id": `${SITE_URL}/#restaurant`,
      name: "Burger Budds", url: `${SITE_URL}/`, image: `${SITE_URL}/logo.png`,
      servesCuisine: ["Burgers", "Fast Food"],
      areaServed: { "@type": "City", name: "Gwalior" },
      hasMenu: `${SITE_URL}/`,
      parentOrganization: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};
