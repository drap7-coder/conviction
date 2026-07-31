import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
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
