import { redirect } from "next/navigation";

// The original /crm landing page only linked to the login. The CRM layout sends signed-out visitors to the
// login screen, and signed-in users straight to the dashboard.
export default function CrmIndexPage() {
  redirect("/crm/entrydashboard");
}
