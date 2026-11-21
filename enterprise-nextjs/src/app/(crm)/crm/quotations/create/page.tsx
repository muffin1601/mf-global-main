import { requireUser } from "@/lib/auth/session";
import { getFormDefaults } from "@/server/quotations/service";
import { QuotationForm } from "../quotation-form";

export const dynamic = "force-dynamic";

export default async function CreateQuotationPage() {
  const user = await requireUser();
  const defaults = await getFormDefaults();
  return <QuotationForm mode="create" canChoosePrefix={user.role === "ADMIN"} defaults={defaults} />;
}
