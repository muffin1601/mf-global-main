import type { Metadata } from "next";
import BlogForm from "@/legacy-marketing/pages/BlogForm";
import { marketingMetadata } from "../../_meta";

export const metadata: Metadata = {
  ...marketingMetadata("Create a Blog | MF Global Services", "Create a new post for MF Global Services.", "/blogs/new"),
  robots: { index: false, follow: false },
};

export default function NewBlogPage() {
  return <BlogForm />;
}
