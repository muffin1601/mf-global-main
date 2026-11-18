import type { Metadata } from "next";
import { VendorListView } from "./_components/vendor-list-view";
import type { SP } from "./_lib";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vendors" };

export default async function VendorsPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <VendorListView preset="all" searchParams={await searchParams} />;
}
