import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/rising",
        destination: "/trending",
        permanent: true,
      },
      {
        source: "/markets",
        destination: "/pulse",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
