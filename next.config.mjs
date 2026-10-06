/** @type {import('next').NextConfig} */
const nextConfig = (phase) => ({
  distDir: process.env.NEXT_BUILD_DIR || (phase === "phase-development-server" ? ".next-dev" : ".next"),
  async headers() {
    return ["/merchant/:path*", "/checkout/:path*", "/track/:path*", "/api/:path*"].map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
});

export default nextConfig;
