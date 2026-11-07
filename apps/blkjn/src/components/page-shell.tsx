import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader, type PageId } from "@/components/site-header";

export function PageShell({
  current,
  children,
}: {
  current: PageId;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader current={current} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
