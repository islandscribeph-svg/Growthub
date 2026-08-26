"use client";

import { useRouter } from "next/navigation";

export function NavBar({ userName, role }: { userName: string; role: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
      <span className="text-sm font-semibold tracking-tight text-neutral-900">Growthub</span>
      <div className="flex items-center gap-3 text-sm text-neutral-500">
        <span>
          {userName} <span className="text-neutral-400">· {role}</span>
        </span>
        <button onClick={handleLogout} className="rounded-md px-2 py-1 text-neutral-500 hover:bg-neutral-100">
          Sign out
        </button>
      </div>
    </header>
  );
}
