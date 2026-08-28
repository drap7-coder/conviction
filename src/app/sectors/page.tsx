import { permanentRedirect } from "next/navigation";

/** Legacy Menu route — Sectors now lives on Pulse. */
export default function SectorsPage() {
  permanentRedirect("/pulse?view=sectors");
}
