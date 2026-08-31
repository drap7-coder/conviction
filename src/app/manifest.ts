import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/pulse",
    display: "standalone",
    background_color: "#0A0E14",
    theme_color: "#0A0E14",
    icons: [
      { src: "/brand-favicon.png?v=20260831b", sizes: "512x512", type: "image/png" },
      { src: "/brand-apple-icon.png?v=20260831b", sizes: "180x180", type: "image/png" },
    ],
  };
}
