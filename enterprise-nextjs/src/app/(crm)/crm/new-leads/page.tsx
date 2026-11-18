import { LeadListView } from "@/components/leads/lead-list-view";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <LeadListView preset="new" searchParams={searchParams} />;
}
