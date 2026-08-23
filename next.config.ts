import type { NextConfig } from "next";

const CANONICAL_ORIGIN = "https://www.gotconviction.com";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.google.com",
        pathname: "/s2/favicons/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "gotconviction.com" }],
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
        destination: "/watchlist",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
