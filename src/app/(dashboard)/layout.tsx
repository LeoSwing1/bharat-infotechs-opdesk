import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import NotificationBell from "@/components/notifications/NotificationBell";
import { DesktopSidebar, MobileNav } from "@/components/layout/Sidebar";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen md:flex">
      <DesktopSidebar userName={user.name} userRole={user.role} />

      {/* Main */}
      <main className="min-w-0 flex-1">
        <header className="flex h-14 items-center justify-between border-b bg-white px-4 sm:h-16 sm:px-5 md:px-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <MobileNav userName={user.name} userRole={user.role} />
            <div className="font-black md:hidden">
              OPDesk
            </div>

            <div className="hidden text-sm text-gray-500 sm:block">
              Workforce Operations
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification Bell */}
            <NotificationBell />

            {/* User */}
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-gray-900">
                {user.name}
              </div>

              <div className="text-[11px] text-gray-500">
                {user.role}
              </div>
            </div>

            {/* Logout */}
            <form
              action="/api/auth/logout"
              method="post"
            >
              <button
                type="submit"
                className="text-sm text-gray-600 transition hover:text-gray-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <div className="p-4 sm:p-5 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}