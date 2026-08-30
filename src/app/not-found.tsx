import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <main className="not-found-page">
      <h1>Page not found</h1>
      <p>That route isn’t on IQBulls.</p>
      <Link href="/pulse">Back to Pulse</Link>
    </main>
  );
}
