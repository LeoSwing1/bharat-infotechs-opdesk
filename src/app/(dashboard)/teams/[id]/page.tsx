"use client";
import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";

type Team = {
  id: string; name: string; code: string; description?: string | null; active: boolean;
  leadUserId?: string | null; hrUserId?: string | null; departmentName?: string | null;
};
type Member = { id: string; name: string; email: string; role: string; employeeCode?: string | null; designation?: string | null; status: string };
type Person = { id: string; name: string; role: string };

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addUserId, setAddUserId] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true); setError("");
    const [res, peopleRes] = await Promise.all([fetch(`/api/teams/${id}`), fetch("/api/people")]);
    const data = await res.json();
    const peopleData = await peopleRes.json();
    if (!res.ok) { setError(data.error ?? "Could not load this team"); setLoading(false); return; }
    setTeam(data.team);
    setMembers(data.members ?? []);
    setAllPeople(peopleData.people ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  const memberIds = useMemo(() => new Set(members.map(m => m.id)), [members]);
  const addCandidates = allPeople.filter(p => !memberIds.has(p.id));

  async function addMember() {
    if (!addUserId) return;
    setBusy(true);
    const res = await fetch(`/api/teams/${id}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: addUserId }),
    });
    setBusy(false);
    if (res.ok) { setAddUserId(""); load(); }
  }

  async function removeMember(userId: string) {
    setBusy(true);
    const res = await fetch(`/api/teams/${id}/members?userId=${userId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) load();
  }

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  if (error) return <div className="card p-8 text-sm text-red-700">{error}</div>;
  if (!team) return null;

  return (
    <div>
      <Link href="/teams" className="text-sm text-gray-500 hover:text-gray-800">← Back to Teams</Link>

      <div className="card mt-4 p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{team.name}</h1>
            <p className="mt-1 text-sm text-gray-500">Code: {team.code}{team.departmentName ? ` · ${team.departmentName}` : ""}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${team.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
            {team.active ? "Active" : "Archived"}
          </span>
        </div>
        {team.description && <p className="mt-4 text-sm text-gray-600">{team.description}</p>}
      </div>

      <div className="card mt-5 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Members ({members.length})</h2>
          <div className="flex gap-2">
            <select value={addUserId} onChange={e => setAddUserId(e.target.value)} className="rounded-xl border p-2 text-sm">
              <option value="">Add a person…</option>
              {addCandidates.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={addMember} disabled={!addUserId || busy} className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add</button>
          </div>
        </div>

        {members.length === 0 ? (
          <EmptyState title="No members yet" description="Add people to this team using the dropdown above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Employee ID</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="py-3">
                      <Link href={`/people/${m.id}`} className="font-medium hover:underline">{m.name}</Link>
                      <div className="text-xs text-gray-500">{m.email}</div>
                    </td>
                    <td className="py-3 text-gray-600">{m.employeeCode ?? "—"}</td>
                    <td className="py-3 text-gray-600">{m.role.replace(/_/g, " ")}</td>
                    <td className="py-3"><StatusBadge status={m.status} /></td>
                    <td className="py-3 text-right">
                      <button onClick={() => removeMember(m.id)} disabled={busy} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">Remove</button>
                    </td>
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
