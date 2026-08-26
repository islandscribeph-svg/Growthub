import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Growthub",
  description: "Weekly call-tracking dashboard synced from a Google Calendar",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        {user && <NavBar userName={user.name} role={user.role} />}
        <main className="flex-1 min-h-0">{children}</main>
      </body>
    </html>
  );
}
