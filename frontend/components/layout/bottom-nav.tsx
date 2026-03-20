"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Users, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: string;
};

const tabs: Tab[] = [
  { href: "/races", label: "HOME", icon: Home },
  { href: "/diary", label: "DIARY", icon: BookOpen, matchPrefix: "/diary" },
  { href: "/community", label: "COMMUNITY", icon: Users },
  { href: "/profile", label: "PROFILE", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav border-t-2 border-[#ffff00] flex md:hidden">
      {tabs.map(({ href, label, icon: Icon, matchPrefix }) => {
        const isActive =
          pathname === href ||
          (matchPrefix != null &&
            pathname.startsWith(matchPrefix) &&
            pathname !== "/races");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
              isActive
                ? "text-[#ffff00]"
                : "text-[#cac8aa] hover:text-[#f8f8f5]"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="tech-label text-[8px]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
