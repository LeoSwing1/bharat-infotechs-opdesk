"use client";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";

type TimesheetRecord = {
  id: string; userId: string; attendanceDate: string; status: string;
  clockInAt: string | null; clockOutAt: string | null; breakMinutes: number;
  workedMinutes: number | null; overtimeMinutes: number;
};
type Person = { id: string; name: string; employeeCode?: string | null };
type Team = { id: string; name: string };
type SessionUser = { id: string; role: string };

function formatHours(min: number | null | undefined) {
  if (min == null) return "—";
  return `${(min / 60).toFixed(1)}h`;
}
function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TimesheetsPage() {
  const [records, setRecords] = useState<TimesheetRecord[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const isManagement = me?.role === "SUPER_ADMIN" || me?.role === "HR_MANAGER" || me?.role === "MANAGER" || me?.role === "MANAGER" || me?.role === "TEAM_LEAD";

  async function load() {
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    if (teamId) params.set("teamId", teamId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const [recRes, peopleRes, teamsRes, meRes] = await Promise.all([
      fetch(`/api/timesheets?${params}`), fetch("/api/people"), fetch("/api/teams"), fetch("/api/auth/me"),
    ]);
    const [recData, peopleData, teamsData, meData] = await Promise.all([recRes.json(), peopleRes.json(), teamsRes.json(), meRes.json()]);
    if (!recRes.ok) { setError(recData.error ?? "Could not load timesheets"); setLoading(false); return; }
    setRecords(recData.records ?? []);
    setPeople(peopleData.people ?? []);
    setTeams(teamsData.teams ?? []);
    setMe(meData.user ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const peopleById = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);
  const totalWorked = records.reduce((sum, r) => sum + (r.workedMinutes ?? 0), 0);
  const totalOvertime = records.reduce((sum, r) => sum + r.overtimeMinutes, 0);

  function exportCsv() {
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    if (teamId) params.set("teamId", teamId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    window.location.href = `/api/timesheets/export?${params}`;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Timesheets</h1>
          <p className="mt-1 text-gray-500">Hours worked, breaks and overtime, computed from attendance.</p>
        </div>
        <button onClick={exportCsv} className="rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-gray-50">
          Export CSV
        </button>
      </div>

      <div className="card mb-5 flex flex-wrap gap-3 p-4">
        {isManagement && (
          <select value={userId} onChange={e => setUserId(e.target.value)} className="rounded-xl border p-2 text-sm">
            <option value="">All people</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {isManagement && (
          <select value={teamId} onChange={e => setTeamId(e.target.value)} className="rounded-xl border p-2 text-sm">
            <option value="">All teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-xl border p-2 text-sm" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-xl border p-2 text-sm" />
        <button onClick={load} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Apply</button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-4"><div className="text-2xl font-bold">{loading ? "—" : records.length}</div><div className="text-sm text-gray-500">Records</div></div>
        <div className="card p-4"><div className="text-2xl font-bold">{loading ? "—" : formatHours(totalWorked)}</div><div className="text-sm text-gray-500">Total Worked</div></div>
        <div className="card p-4"><div className="text-2xl font-bold">{loading ? "—" : formatHours(totalOvertime)}</div><div className="text-sm text-gray-500">Total Overtime</div></div>
      </div>

      <div className="card p-5">
        {error ? (
          <div className="p-4 text-sm text-red-700">{error}</div>
        ) : loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-gray-100" />)}</div>
        ) : records.length === 0 ? (
          <EmptyState title="No timesheet records" description="Adjust your filters, or check back after some attendance has been logged." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  {isManagement && <th className="pb-3 font-medium">Employee</th>}
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">In</th>
                  <th className="pb-3 font-medium">Out</th>
                  <th className="pb-3 font-medium">Break</th>
                  <th className="pb-3 font-medium">Worked</th>
                  <th className="pb-3 font-medium">Overtime</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b last:border-0">
                    {isManagement && (
                      <td className="py-3 font-medium">
                        {peopleById.get(r.userId)?.name ?? r.userId}
                        <div className="text-xs font-normal text-gray-500">{peopleById.get(r.userId)?.employeeCode}</div>
                      </td>
                    )}
                    <td className="py-3">{r.attendanceDate}</td>
                    <td className="py-3 text-gray-600">{formatTime(r.clockInAt)}</td>
                    <td className="py-3 text-gray-600">{formatTime(r.clockOutAt)}</td>
                    <td className="py-3 text-gray-600">{formatHours(r.breakMinutes)}</td>
                    <td className="py-3 text-gray-600">{formatHours(r.workedMinutes)}</td>
                    <td className="py-3 text-gray-600">{r.overtimeMinutes > 0 ? formatHours(r.overtimeMinutes) : "—"}</td>
                    <td className="py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
