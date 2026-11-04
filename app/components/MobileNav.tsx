"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Tidning", icon: "newspaper" },
  { href: "/profil", label: "Profil", icon: "user" },
  { href: "/health", label: "KÃ¤llor", icon: "activity" },
] as const;

type NavIconName = (typeof NAV_ITEMS)[number]["icon"];

function NavIcon({ name }: { name: NavIconName }) {
  const shared = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (name === "newspaper") {
    return (
      <svg {...shared}>
        <path d="M4 5.5h13a2 2 0 0 1 2 2V20H5a2 2 0 0 1-2-2V6.5a1 1 0 0 1 1-1Z" />
        <path d="M19 9h2v9a2 2 0 0 1-2 2" />
        <path d="M7 9h8M7 12h8M7 15h4" />
      </svg>
    );
  }

  if (name === "user") {
    return (
      <svg {...shared}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    );
  }

  return (
    <svg {...shared}>
      <path d="M3 12h4l3-7 4 14 3-7h4" />
    </svg>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Huvudnavigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-300 bg-[#f4f1e8]/95 pb-[max(env(safe-area-inset-bottom),8px)] shadow-[0_-4px_18px_rgba(15,23,42,0.08)] backdrop-blur md:hidd¶»§q«^