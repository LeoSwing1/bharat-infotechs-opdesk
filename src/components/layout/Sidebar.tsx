"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = [label: string, href: string];

const links: NavLink[] = [
  ["Dashboard", "/dashboard"],
  ["Management Center", "/management"],
  ["People", "/people"],
  ["Teams", "/teams"],
  ["Projects", "/projects"],
  ["Tasks", "/tasks"],
  ["Chats", "/chat"],
  ["Meetings", "/meetings"],
  ["Attendance", "/attendance"],
  ["Timesheets", "/timesheets"],
  ["Daily Updates", "/daily-updates"],
  ["Leave", "/leave"],
  ["Quality & Performance", "/quality"],
  ["Notifications", "/notifications"],
  ["Warnings", "/warnings"],
  ["Reports", "/reports"],
  ["Training", "/training"],
  ["Settings", "/settings"],
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="mt-4 flex-1 space-y-1">
      {links.map(([label, href]) => {
        const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href + "/"));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`navlink ${active ? "bg-gray-900 !text-white hover:!bg-gray-900" : ""}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DesktopSidebar({ userName, userRole }: { userName: string; userRole: string }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-white p-4 md:flex">
      <div className="px-3 py-4">
        <div className="text-2xl font-black">OPDesk</div>
        <div className="text-xs text-gray-500">Workforce Operations</div>
      </div>

      <NavLinks />

      <div className="border-t pt-4 text-sm">
        <div className="font-semibold">{userName}</div>
        <div className="text-gray-500">{userRole}</div>
      </div>
    </aside>
  );
}

export function MobileNav({ userName, userRole }: { userName: string; userRole: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer automatically whenever the route changes.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Prevent background scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 md:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between px-3 py-4">
              <div>
                <div className="text-2xl font-black">OPDesk</div>
                <div className="text-xs text-gray-500">Workforce Operations</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>

            <div className="border-t pt-4 text-sm">
              <div className="font-semibold">{userName}</div>
              <div className="text-gray-500">{userRole}</div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
