"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, BookOpen, Users, User, PlusCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
// Button removed: base-ui Button does not support asChild; using a styled Link instead

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/races", label: "Calendario", icon: Calendar },
  { href: "/diary", label: "Diario", icon: BookOpen },
  { href: "/community", label: "Community", icon: Users },
  { href: "/profile", label: "Profilo", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-[#18181b] border-r border-zinc-800 p-4 gap-1">
      <div className="px-2 py-3 mb-4">
        <span className="font-bold text-lg tracking-tight text-zinc-50">
          Cycle<span className="text-[#E91E8C]">Tracker</span>
        </span>
      </div>

      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href || (href !== "/races" && pathname.startsWith(href));
        return (
          <Link key={href} href={href}>
            <span
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-zinc-800 text-zinc-50"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </span>
          </Link>
        );
      })}

      <div className="mt-4">
        <Link
          href="/diary/new"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#E91E8C] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#c4186f]"
        >
          <PlusCircle className="w-4 h-4" />
          Scrivi recensione
        </Link>
      </div>
    </aside>
  );
}
