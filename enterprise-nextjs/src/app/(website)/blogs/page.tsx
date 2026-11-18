import BlogList from "@/legacy-marketing/pages/BlogList";
import { marketingMetadata } from "../_meta";

export const metadata = marketingMetadata(
  "Insights & Updates | MF Global Services",
  "Read the latest news and insights from MF Global Services.",
  "/blogs",
);

export default function BlogsPage() {
  return <BlogList />;
}
