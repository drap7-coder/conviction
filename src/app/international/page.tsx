import { permanentRedirect } from "next/navigation";

/** Legacy Menu route — International now lives on Pulse. */
export default function InternationalPage() {
  permanentRedirect("/pulse?view=international");
}
