import Link from "next/link";
import { Logo } from "@/components/logo";

export type PageId = "home" | "store" | "request" | "about" | "checkout";

const links: readonly { href: string; id: PageId; label: string }[] = [
  { href: "/", id: "home", label: "Home" },
  { href: "/store", id: "store", label: "Store" },
  { href: "/request", id: "request", label: "Request" },
  { href: "/about", id: "about", label: "About" },
];

export function SiteHeader({ current }: { current: PageId }) {
  return (
    <header className="site-header">
      <div className="frame header-bar">
        <Link href="/" className="logo-link" aria-label="BLKJN home">
          <Logo />
        </Link>
        <nav className="site-nav" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              aria-current={link.id === current ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="availability-note">
          <span className="availability-full">PURCHASES UNAVAILABLE</span>
          <span className="availability-short">UNAVAILABLE</span>
        </p>
      </div>
    </header>
  );
}
