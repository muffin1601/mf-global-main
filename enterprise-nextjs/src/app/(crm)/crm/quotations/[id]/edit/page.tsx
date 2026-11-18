import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { HttpError } from "@/server/errors";
import { getFormDefaults, getQuotation } from "@/server/quotations/service";
import { QuotationForm } from "../../quotation-form";

export const dynamic = "force-dynamic";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const quotation = await getQuotation({ id: user.id, role: user.role, name: user.name }, id).catch((e) => {
    if (e instanceof HttpError && (e.status === 404 || e.status === 400 || e.status === 403)) return null;
    throw e;
  });
  if (!quotation) notFound();
  const defaults = await getFormDefaults();
  return <QuotationForm mode="edit" defaults={defaults} quotation={quotation} />;
}
