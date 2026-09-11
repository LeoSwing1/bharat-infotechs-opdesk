import Link from "next/link";

const SECTIONS = [
  { href: "/settings/organization", title: "Organization", description: "Name, logo and contact information." },
  { href: "/settings/departments", title: "Departments", description: "Create and manage organizational departments." },
  { href: "/settings/users", title: "Users", description: "Manage user accounts via the People module." },
  { href: "/settings/permissions", title: "Roles & Permissions", description: "Configure what each role can see and do." },
  { href: "/settings/shifts", title: "Shifts", description: "Define shift schedules for attendance and overtime." },
  { href: "/settings/security", title: "Security", description: "Change your password." },
  { href: "/settings/notifications", title: "Notifications", description: "Email, push and WhatsApp notification preferences." },
  { href: "/settings/email", title: "Email", description: "SMTP configuration and email delivery logs." },
  { href: "/settings/automation", title: "Automation", description: "Reminders and automated workflow rules." },
  { href: "/settings/integrations", title: "Integrations", description: "Connection readiness for email, Google Calendar, WhatsApp, push and chat." },
];

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-gray-500">Organization, users, permissions, notifications, automation and email settings.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(s => (
          <Link key={s.href} href={s.href} className="card block p-5 transition hover:shadow-md">
            <div className="font-semibold">{s.title}</div>
            <p className="mt-1.5 text-sm text-gray-500">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
