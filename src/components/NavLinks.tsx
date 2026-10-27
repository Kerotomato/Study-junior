"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string; badge?: number }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 px-2 pb-2">
      {links.map((l) => {
        const active = l.href === pathname || (l.href.split("/").length > 2 && pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`relative shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${active ? "bg-brand text-white" : "bg-white text-stone-600"}`}
          >
            {l.label}
            {!!l.badge && (
              <span className="ml-1 rounded-full bg-red-500 px-1.5 text-xs text-white">{l.badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
