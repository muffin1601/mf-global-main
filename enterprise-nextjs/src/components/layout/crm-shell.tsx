import Link from "next/link";
import { BarChart3, BriefcaseBusiness, FileText, LayoutDashboard, Package, Truck, Upload, Users } from "lucide-react";
import type { UserRole } from "@/generated/prisma/enums";

const links=[
  ["Dashboard","/crm/entrydashboard",LayoutDashboard],
  ["Leads","/crm/lead-management",BriefcaseBusiness],
  ["Import leads","/crm/import-leads",Upload],
  ["Products","/crm/product-management",Package],
  ["Vendors","/crm/vendors",Truck],
  ["Quotations","/crm/quotations",FileText]
] as const;
export function CrmShell({children,user}:{children:React.ReactNode;user:{name:string;role:UserRole}}){return <div className="app-shell"><aside className="sidebar"><Link className="brand" href="/crm/entrydashboard"><span className="brand-mark">MF</span><span>Enterprise CRM</span></Link><div className="nav-group">Workspace</div>{links.map(([label,href,Icon])=><Link className="side-link" href={href} key={href}><Icon size={17}/>{label}</Link>)}{user.role==="ADMIN"&&<><div className="nav-group">Administration</div><Link className="side-link" href="/crm/user-management"><Users size={17}/>User management</Link><Link className="side-link" href="/crm/vendors/performance"><BarChart3 size={17}/>Vendor performance</Link></>}</aside><div className="app-main"><header className="topbar"><div><strong>MF Global Services</strong></div><div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:13,color:"var(--muted)"}}>{user.name} · {user.role.toLowerCase()}</span><form action="/auth/signout" method="post"><button className="button secondary" type="submit">Sign out</button></form></div></header>{children}</div></div>}
