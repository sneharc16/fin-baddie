"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DemoBadge } from "@/components/ui/status";

const links = [
  { href: "/", label: "Catch Up" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/demo", label: "Demo" },
];

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="app-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Groww Delta home">
          <span className="brand-mark" aria-hidden="true">Δ</span>
          <span>Groww Delta</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>{link.label}</Link>
          ))}
        </nav>
        <DemoBadge />
      </div>
    </header>
  );
}
