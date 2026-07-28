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
        destination: "/quotes",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
