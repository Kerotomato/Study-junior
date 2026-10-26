import { signOut } from "@/app/actions/auth";
import { NavLinks } from "./NavLinks";

export function AppShell({
  name,
  links,
  children,
}: {
  name: string;
  links: { href: string; label: string; badge?: number }[];
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-10 bg-amber-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="font-bold">勉強ごほうび</span>
          <form action={signOut} className="flex items-center gap-2 text-sm">
            <span className="text-stone-500">{name}</span>
            <button className="btn-sub">ログアウト</button>
          </form>
        </div>
        <div className="mx-auto max-w-2xl">
          <NavLinks links={links} />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-12 pt-2">{children}</main>
    </>
  );
}
