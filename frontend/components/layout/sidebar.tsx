"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Users, User, PlusCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: string;
};

const navItems: NavItem[] = [
  { href: "/races", label: "HOME", icon: Home },
  { href: "/diary", label: "DIARY", icon: BookOpen, matchPrefix: "/diary" },
  { href: "/community", label: "COMMUNITY", icon: Users },
  { href: "/profile", label: "PROFILE", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-[#202013] border-r-2 border-[#ffff00] p-4 gap-1">
      <div className="px-2 py-4 mb-4 border-b border-[#484831]">
        <span className="kinetic-italic text-lg text-[#f8f8f5]">
          Cycle<span className="text-[#ffff00]">Tracker</span>
        </span>
      </div>

      {navItems.map(({ href, label, icon: Icon, matchPrefix }) => {
        const isActive =
          pathname === href ||
          (matchPrefix != null &&
            pathname.startsWith(matchPrefix) &&
            pathname !== "/races");
        return (
          <Link key={href} href={href}>
            <span
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-[#ffff00]/10 text-[#ffff00] border-l-2 border-[#ffff00]"
                  : "text-[#cac8aa] hover:text-[#f8f8f5] hover:bg-[#2b2b1d]"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="tech-label">{label}</span>
            </span>
          </Link>
        );
      })}

      <div className="mt-4">
        <Link
          href="/diary/new"
          className="flex w-full items-center justify-center gap-2 bg-[#ffff00] text-black px-3 py-2 text-sm font-black uppercase tracking-tighter transition-colors hover:bg-[#cdcd00]"
        >
          <PlusCircle className="w-4 h-4" />
          Scrivi recensione
        </Link>
      </div>
    </aside>
  );
}
