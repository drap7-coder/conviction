import type { Metadata } from "next";
import {
  PULSE_DESCRIPTION,
  PULSE_WEBPAGE_NAME,
  SITE_ALTERNATE_NAMES,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_URL,
  absoluteUrl,
} from "@/lib/site";
import type { FaqItem } from "@/lib/product-copy";

export function pageMetadata({
  title,
  description,
  path,
  index = true,
  absoluteTitle = false,
  openGraphTitle,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  /** Skip the “Page · IQBulls” template — use for the public homepage card. */
  absoluteTitle?: boolean;
  /** Optional shorter OG/Twitter title (defaults to the document title). */
  openGraphTitle?: string;
}): Metadata {
  const url = absoluteUrl(path);
  const socialTitle = openGraphTitle
    ?? (absoluteTitle ? title : `${title} · ${SITE_NAME}`);

  return {
    title: absoluteTitle ? { absolute: title } : title,
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

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;
const APP_ID = `${SITE_URL}/#software`;

export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: SITE_NAME,
        alternateName: [...SITE_ALTERNATE_NAMES],
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl("/icon.png"),
          width: 512,
          height: 512,
        },
        image: absoluteUrl("/favicon-192.png"),
      },
      {
        "@type": "WebSite",
        "@id": SITE_ID,
        name: SITE_NAME,
        alternateName: [...SITE_ALTERNATE_NAMES],
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "SoftwareApplication",
        "@id": APP_ID,
        name: SITE_NAME,
        alternateName: [...SITE_ALTERNATE_NAMES],
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        image: absoluteUrl("/icon.png"),
        publisher: { "@id": ORG_ID },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
    ],
  };
}

/** Pulse-only WebPage node — references site graph by @id, no duplicates. */
export function pulsePageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/pulse#webpage`,
        name: PULSE_WEBPAGE_NAME,
        url: `${SITE_URL}/pulse`,
        description: PULSE_DESCRIPTION,
        isPartOf: { "@id": SITE_ID },
        about: { "@id": APP_ID },
      },
    ],
  };
}

export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
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
