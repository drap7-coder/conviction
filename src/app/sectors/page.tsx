import { permanentRedirect } from "next/navigation";

/** Legacy Menu route — Sectors now sit on Pulse Markets. */
export default function SectorsPage() {
  permanentRedirect("/pulse");
}
