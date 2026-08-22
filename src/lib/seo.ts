import type { Metadata } from "next";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_TITLE,
  SITE_URL,
  absoluteUrl,
} from "@/lib/site";

export function pageMetadata({
  title,
  description,
  path,
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const socialTitle = `${title} · ${SITE_NAME}`;

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    robots: {
      index,
      follow: true,
    },
    openGraph: {
      title: socialTitle,
      description,
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      images: [{ ...SITE_OG_IMAGE, url: absoluteUrl(SITE_OG_IMAGE.url) }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [absoluteUrl(SITE_OG_IMAGE.url)],
    },
  };
}

export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        logo: absoluteUrl("/conviction-bull.png"),
      },
      {
        "@type": "WebSite",
        name: SITE_TITLE,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        publisher: { "@type": "Organization", name: SITE_NAME },
      },
    ],
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
