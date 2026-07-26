import type { OpenAttentionItem } from "@/lib/market/open-attention";

export type CompanyPulseTone = "leading" | "confirming" | "cooling" | "steady";

export interface CompanyPulseCopy {
  headline: string;
  tone: CompanyPulseTone;
}

export function getCompanyPulseCopy(item: OpenAttentionItem): CompanyPulseCopy {
  if (item.signal === "attention-leading") {
    return { headline: "Attention is moving before price", tone: "leading" };
  }
  if (item.signal === "price-confirming") {
    return { headline: "Chatter confirms the price move", tone: "confirming" };
  }
  if (item.signal === "cooling") {
    return { headline: "Market attention is cooling", tone: "cooling" };
  }
  if (item.mentionsLastHour === 0) {
    return { headline: "Open-market attention is quiet", tone: "steady" };
  }
  return { headline: "Attention is near its baseline", tone: "steady" };
}
