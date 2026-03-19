"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, BookOpen, PlusCircle, Users, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  accent?: boolean;
};

const tabs: Tab[] = [
  { href: "/races", label: "Calendario", icon: Calendar },
  { href: "/diary", label: "Diario", icon: BookOpen },
  { href: "/diary/new", label: "Scrivi", icon: PlusCircle, accent: true },
  { href: "/community", label: "Community", icon: Users },
  { href: "/profile", label: "Profilo", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#18181b] border-t border-zinc-800 flex md:hidden">
      {tabs.map(({ href, label, icon: Icon, accent }) => {
        const isActive =
          pathname === href ||
          (href !== "/races" &&
            href !== "/diary/new" &&
            pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] transition-colors",
              accent
                ? "text-[#E91E8C]"
                : isActive
                  ? "text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Icon
              className={cn(
                "transition-all",
                accent
                  ? "w-7 h-7 drop-shadow-[0_0_8px_rgba(233,30,140,0.6)]"
                  : "w-5 h-5"
              )}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
