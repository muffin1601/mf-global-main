import Contact from "@/legacy-marketing/pages/Contact";
import { marketingMetadata } from "../_meta";

export const metadata = marketingMetadata(
  "Contact Us | MF Global Services",
  "Contact MF Global Services to discuss corporate gifting, digital marketing, and website development.",
  "/contact",
);

export default function ContactPage() {
  return <Contact />;
}
