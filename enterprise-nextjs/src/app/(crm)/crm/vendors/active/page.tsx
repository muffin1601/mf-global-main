import type { Metadata } from "next";
import { VendorListView } from "../_components/vendor-list-view";
import type { SP } from "../_lib";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Active vendors" };

export default async function ActiveVendorsPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <VendorListView preset="active" searchParams={await searchParams} />;
}
