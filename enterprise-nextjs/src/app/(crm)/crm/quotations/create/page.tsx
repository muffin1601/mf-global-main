import { requireUser } from "@/lib/auth/session";
import { getFormDefaults } from "@/server/quotations/service";
import { QuotationForm } from "../quotation-form";

export const dynamic = "force-dynamic";

export default async function CreateQuotationPage() {
  await requireUser();
  const defaults = await getFormDefaults();
  return <QuotationForm mode="create" defaults={defaults} />;
}
