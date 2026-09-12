import type { Metadata } from "next";
import "./widgets.css";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
