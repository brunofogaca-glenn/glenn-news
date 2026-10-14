"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Tidning", icon: "newspaper" },
  { href: "/veckofokus", label: "Veckofokus", icon: "book" },
  { href: "/profil", label: "Profil", icon: "user" },
  { href: "/health", label: "Källor", icon: "activity" },
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

  if (name === "book") {
    return (
      <svg {...shared}>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" />
        <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h7M8 10h7" />
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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-300 bg-[#f4f1e8]/95 pb-[max(env(safe-area-inset-bottom),8px)] shadow-[0_-4px_18px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-xl grid-cols-4">
        {NAV_ITEMS.map(item => {
          const active = item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                "relative flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 pt-2 text-center transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-orange-700 " +
                (active
                  ? "text-orange-800"
                  : "text-slate-500 hover:text-slate-950")
              }
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-4 top-0 h-[3px] bg-orange-700"
                />
              )}
              <NavIcon name={item.icon} />
              <span className="text-[9px] font-bold uppercase tracking-[0.08em]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
