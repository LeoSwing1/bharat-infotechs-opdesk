"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";

type Summary = {
  scope: "organization" | "team" | "personal" | "demo";
  available: boolean;
  totalPeople?: number;
  activePeople?: number;
  activeTeams?: number;
  totalTasks?: number;
  overdueTasks?: number;
  teamMembers?: number;
  myTasks?: number;
  myOverdueTasks?: number;
  tasksByStatus?: Record<string, number>;
};
type SessionUser = { name: string; role: string };
type OperationsOverview = {
  available: boolean;
  scope: "organization" | "team" | "personal" | "demo";
  activePeople?: number;
  attendanceRecorded?: number;
  attendanceMissing?: number;
  dailyUpdatesSubmitted?: number;
  dailyUpdatesMissing?: number;
  openTasks?: number;
  overdueTasks?: number;
  openWarnings?: number;
  pendingApprovals?: number;
  upcomingMeetings?: number;
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OperationsOverview | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/dashboard/summary").then(r => r.json()), fetch("/api/auth/me").then(r => r.json()), fetch("/api/workforce/overview", { cache: "no-store" }).then(r => r.json())])
      .then(([summaryData, meData, overviewData]) => { setSummary(summaryData); setMe(meData.user ?? null); setOverview(overviewData); })
      .finally(() => setLoading(false));
  }, []);

  const firstName = me?.name?.split(" ")[0];

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{greeting()}{firstName ? `, ${firstName}` : ""}.</h1>
        <p className="mt-1 text-sm text-gray-500 sm:text-base">Here&apos;s what needs attention across OPDesk.</p>
      </div>

      {!loading && overview?.available && overview.scope !== "demo" && (
        <OperationsPanel overview={overview} />
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
      ) : summary?.scope === "demo" ? (
        <EmptyState
          title="Live stats need a database"
          description="Connect PostgreSQL and disable demo mode to see real organization-wide numbers here."
        />
      ) : summary?.scope === "organization" ? (
        <OrgStats summary={summary} />
      ) : summary?.scope === "team" ? (
        <TeamStats summary={summary} />
      ) : summary?.scope === "personal" ? (
        <PersonalStats summary={summary} />
      ) : (
        <EmptyState title="Could not load dashboard stats" description="Try refreshing the page." />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="text-xs text-gray-500 sm:text-sm">{label}</div>
      <div className="mt-1.5 text-2xl font-bold sm:mt-2 sm:text-3xl">{value}</div>
    </div>
  );
}

function StatusBreakdown({ tasksByStatus }: { tasksByStatus?: Record<string, number> }) {
  const entries = Object.entries(tasksByStatus ?? {});
  if (entries.length === 0) return <p className="text-sm text-gray-500">No tasks yet.</p>;
  return (
    <div className="space-y-2.5">
      {entries.map(([status, count]) => (
        <div key={status} className="flex items-center justify-between text-sm">
          <span className="text-gray-600">{status.replace(/_/g, " ")}</span>
          <span className="font-semibold">{count}</span>
        </div>
      ))}
    </div>
  );
}

function OrgStats({ summary }: { summary: Summary }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total People" value={summary.totalPeople ?? 0} />
        <StatCard label="Active People" value={summary.activePeople ?? 0} />
        <StatCard label="Active Teams" value={summary.activeTeams ?? 0} />
        <StatCard label="Overdue Tasks" value={summary.overdueTasks ?? 0} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <section className="card p-5 sm:p-6 lg:col-span-2">
          <h2 className="text-base font-bold sm:text-lg">Attention Required</h2>
          <div className="mt-4 space-y-3">
            {(summary.overdueTasks ?? 0) > 0 ? (
              <Link href="/tasks" className="block rounded-xl bg-red-50 p-4 text-sm text-red-800 hover:bg-red-100">
                {summary.overdueTasks} overdue task{summary.overdueTasks === 1 ? "" : "s"} need review.
              </Link>
            ) : (
              <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">No overdue tasks. Nice work.</div>
            )}
          </div>
        </section>
        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-bold sm:text-lg">Tasks by Status</h2>
          <div className="mt-4"><StatusBreakdown tasksByStatus={summary.tasksByStatus} /></div>
        </section>
      </div>
    </>
  );
}

function TeamStats({ summary }: { summary: Summary }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Team Members" value={summary.teamMembers ?? 0} />
        <StatCard label="Total Tasks" value={summary.totalTasks ?? 0} />
        <StatCard label="Overdue Tasks" value={summary.overdueTasks ?? 0} />
      </div>
      <section className="card mt-5 p-5 sm:p-6">
        <h2 className="text-base font-bold sm:text-lg">Tasks by Status</h2>
        <div className="mt-4"><StatusBreakdown tasksByStatus={summary.tasksByStatus} /></div>
      </section>
      {(summary.teamMembers ?? 0) === 0 && (
        <div className="mt-5">
          <EmptyState title="No team assigned yet" description="Ask your Super Admin to assign you as a Team Lead for a team." />
        </div>
      )}
    </>
  );
}

function PersonalStats({ summary }: { summary: Summary }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="My Tasks" value={summary.myTasks ?? 0} />
        <StatCard label="My Overdue Tasks" value={summary.myOverdueTasks ?? 0} />
      </div>
      <section className="card mt-5 p-5 sm:p-6">
        <h2 className="text-base font-bold sm:text-lg">My Tasks by Status</h2>
        <div className="mt-4"><StatusBreakdown tasksByStatus={summary.tasksByStatus} /></div>
      </section>
    </>
  );
}

function OperationsPanel({ overview }: { overview: OperationsOverview }) {
  const cards = [
    { label: "Open tasks", value: overview.openTasks ?? 0, href: "/tasks" },
    { label: "Overdue", value: overview.overdueTasks ?? 0, href: "/tasks" },
    { label: "Attendance missing", value: overview.attendanceMissing ?? 0, href: "/attendance" },
    { label: "Daily updates missing", value: overview.dailyUpdatesMissing ?? 0, href: "/daily-updates" },
    { label: "Open warnings", value: overview.openWarnings ?? 0, href: "/warnings" },
    { label: "Pending approvals", value: overview.pendingApprovals ?? 0, href: "/warnings" },
    { label: "Meetings today", value: overview.upcomingMeetings ?? 0, href: "/meetings" },
  ];
  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-bold sm:text-lg">Operations command center</h2>
          <p className="text-sm text-gray-500">Today&apos;s work, attendance and compliance signals.</p>
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{overview.scope} scope</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map(card => (
          <Link key={card.label} href={card.href} className="rounded-xl border border-gray-100 bg-gray-50 p-3 transition hover:bg-gray-100">
            <div className="text-2xl font-bold">{card.value}</div>
            <div className="mt-1 text-xs leading-4 text-gray-500">{card.label}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
