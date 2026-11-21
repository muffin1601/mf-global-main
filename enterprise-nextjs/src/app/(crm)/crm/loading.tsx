import { PageSkeleton } from "@/components/ui/skeleton";

// Shown by Next.js while a CRM page's server data loads. Mirrors the standard page layout.
export default function CrmLoading() {
  return <PageSkeleton metrics={4} rows={8} columns={5} />;
}
