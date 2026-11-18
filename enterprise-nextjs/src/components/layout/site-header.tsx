import Link from "next/link";

export function SiteHeader() {
  return <header className="site-header"><div className="container site-nav">
    <Link className="brand" href="/"><span className="brand-mark">MF</span><span>MF Global Services</span></Link>
    <nav className="nav-links" aria-label="Main navigation">
      <Link href="/">Home</Link><Link href="/blogs">Insights</Link><Link href="/careers">Careers</Link><Link href="/contact">Contact</Link>
      <Link className="button" href="/crm/login">CRM sign in</Link>
    </nav>
  </div></header>;
}
