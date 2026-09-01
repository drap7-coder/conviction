import { Suspense } from "react";
import { CrowdBoard } from "@/components/CrowdBoard";

export default function CrowdPage() {
  return (
    <main className="crowd-page">
      <h1 className="sr-only">Crowd</h1>
      <Suspense fallback={<p className="crowd-empty">Loading Crowd…</p>}>
        <CrowdBoard />
      </Suspense>
    </main>
  );
}
