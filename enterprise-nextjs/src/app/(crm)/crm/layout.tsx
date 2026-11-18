import type { Metadata } from "next";
import { CrmShell } from "@/components/layout/crm-shell";
import { requireUser } from "@/lib/auth/session";
export const metadata:Metadata={title:{default:"CRM",template:"%s | MF Global CRM"},robots:{index:false,follow:false,nocache:true}};
export default async function CrmLayout({children}:{children:React.ReactNode}){const user=await requireUser();return <CrmShell user={user}>{children}</CrmShell>}
