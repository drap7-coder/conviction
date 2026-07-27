import { redirect } from "next/navigation";

export default function PortfolioPage() {
  redirect("/watchlist?view=portfolio");
}
