import type { Metadata } from "next";
import { VendorListView } from "../_components/vendor-list-view";
import type { SP } from "../_lib";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inactive vendors" };

export default async function InactiveVendorsPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <VendorListView preset="inactive" searchParams={await searchParams} />;
}
