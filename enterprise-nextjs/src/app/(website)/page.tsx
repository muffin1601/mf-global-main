import Mainhome from "@/legacy-marketing/pages/Mainhome";
import { marketingMetadata } from "./_meta";

export const metadata = marketingMetadata(
  "MF Global Services | Corporate Gifting & Digital Solutions",
  "Explore corporate gifting, digital marketing, and website development solutions from MF Global Services.",
  "/",
);

export default function HomePage() {
  return <Mainhome />;
}
