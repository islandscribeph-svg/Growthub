import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="frame footer-bar">
        <p className="footer-brand">BLKJN · Bahala Ka Jan</p>
        <nav aria-label="Footer">
          <Link href="/">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/store">Store</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/request">Request</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/about">About</Link>
        </nav>
        <p className="availability-note">Purchases unavailable</p>
      </div>
    </footer>
  );
}
