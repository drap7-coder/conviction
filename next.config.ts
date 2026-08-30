import type { NextConfig } from "next";

const CANONICAL_ORIGIN = "https://www.iqbulls.com";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.yimg.com" },
      { protocol: "https", hostname: "**.yahoo.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.wsj.net" },
      { protocol: "https", hostname: "**.reuters.com" },
      { protocol: "https", hostname: "**.reutersmedia.net" },
      { protocol: "https", hostname: "**.cnbcfm.com" },
      { protocol: "https", hostname: "**.nbcnews.com" },
      { protocol: "https", hostname: "**.bloomberg.com" },
      { protocol: "https", hostname: "**.ft.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.wp.com" },
      { protocol: "https", hostname: "**" },
    ],
  },
  async redirects() {
    return [
      // Apex → www
      {
        source: "/",
        has: [{ type: "host", value: "iqbulls.com" }],
        destination: `${CANONICAL_ORIGIN}/pulse`,
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "iqbulls.com" }],
        destination: `${CANONICAL_ORIGIN}/:path*`,
        permanent: true,
      },
      // Legacy CONVICTION hosts → IQBulls
      {
        source: "/",
        has: [{ type: "host", value: "gotconviction.com" }],
        destination: `${CANONICAL_ORIGIN}/pulse`,
        permanent: true,
      },
      {
        source: "/",
        has: [{ type: "host", value: "www.gotconviction.com" }],
        destination: `${CANONICAL_ORIGIN}/pulse`,
        permanent: true,
      },
      {
        source: "/",
        has: [{ type: "host", value: "conviction-orpin.vercel.app" }],
        destination: `${CANONICAL_ORIGIN}/pulse`,
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "gotconviction.com" }],
        destination: `${CANONICAL_ORIGIN}/:path*`,
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.gotconviction.com" }],
        destination: `${CANONICAL_ORIGIN}/:path*`,
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "conviction-orpin.vercel.app" }],
        destination: `${CANONICAL_ORIGIN}/:path*`,
        permanent: true,
      },
      {
        source: "/",
        destination: "/pulse",
        permanent: true,
      },
      {
        source: "/rising",
        destination: "/pulse",
        permanent: true,
      },
      {
        source: "/markets",
        destination: "/pulse",
        permanent: true,
      },
      {
        source: "/trending",
        destination: "/pulse",
        permanent: true,
      },
      {
        source: "/industries",
        destination: "/pulse",
        permanent: true,
      },
      {
        source: "/quotes",
        destination: "/portfolio?view=watchlist",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
