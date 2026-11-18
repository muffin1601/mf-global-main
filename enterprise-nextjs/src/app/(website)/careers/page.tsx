import Careers from "@/legacy-marketing/pages/Careers";
import { marketingMetadata } from "../_meta";

export const metadata = marketingMetadata("Careers | MF Global Services", "Explore current opportunities and apply online.", "/careers");

export default function CareersPage() {
  return <Careers />;
}
