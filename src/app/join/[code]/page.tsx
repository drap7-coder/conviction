import type { Metadata } from "next";
import { JoinInviteClient } from "@/components/JoinInviteClient";
import { pageMetadata } from "@/lib/seo";

type Params = Promise<{ code: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { code } = await params;
  return pageMetadata({
    title: "Join community",
    description: "Accept a campus or company community invite on IQBulls.",
    path: `/join/${code}`,
    index: false,
  });
}

export default async function JoinPage({ params }: { params: Params }) {
  const { code } = await params;
  return <JoinInviteClient code={decodeURIComponent(code)} />;
}
