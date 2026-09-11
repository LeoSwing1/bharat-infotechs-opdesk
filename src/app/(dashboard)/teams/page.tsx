"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";

type Team = {
  id: string; name: string; code: string; description?: string | null; active: boolean;
  leadUserId?: string | null; leadName?: string | null; hrUserId?: string | null; hrName?: string | null;
  departmentName?: string | null; memberCount: number;
};
type Person = { id: string; name: string; role: string };
type Department = { id: string; name: string };
type SessionUser = { id: string; role: string };

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [teamsRes, peopleRes, deptRes, meRes] = await Promise.all([
      fetch("/api/teams"), fetch("/api/people"), fetch("/api/departments"), fetch("/api/auth/me"),
    ]);
    const [teamsData, peopleData, deptData, meData] = await Promise.all([
      teamsRes.json(), peopleRes.json(), deptRes.json(), meRes.json(),
    ]);
    setTeams(teamsData.teams ?? []);
    setPeople(peopleData.people ?? []);
    setDepartments(deptData.departments ?? []);
    setMe(meData.user ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const canCreate = me?.role === "SUPER_ADMIN" || me?.role === "HR_MANAGER" || me?.role === "MANAGER";
  const activeTeams = useMemo(() => teams.filter(t => t.active), [teams]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="mt-1 text-gray-500">Create teams, assign team leads and manage members.</p>
        </div>
        {canCreate && (
          <button onClick={() => setModalOpen(true)} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
            + Create Team
          </button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-4"><div className="text-2xl font-bold">{loading ? "—" : teams.length}</div><div className="text-sm text-gray-500">Total teams</div></div>
        <div className="card p-4"><div className="text-2xl font-bold">{loading ? "—" : activeTeams.length}</div><div className="text-sm text-gray-500">Active</div></div>
        <div className="card p-4"><div className="text-2xl font-bold">{loading ? "—" : teams.reduce((sum, t) => sum + t.memberCount, 0)}</div><div className="text-sm text-gray-500">Total members</div></div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
      ) : teams.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description="Create your first team to start assigning people and work."
          action={canCreate ? <button onClick={() => setModalOpen(true)} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">+ Create Team</button> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map(t => (
            <Link key={t.id} href={`/teams/${t.id}`} className="card block p-5 transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-gray-500">Code: {t.code}</div>
                </div>
                {!t.active && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">Archived</span>}
              </div>
              {t.description && <p className="mt-2 line-clamp-2 text-sm text-gray-500">{t.description}</p>}
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-gray-500">{t.memberCount} member{t.memberCount === 1 ? "" : "s"}</span>
                <span className="text-gray-500">TL: {t.leadName ?? "—"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateTeamModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        people={people}
        departments={departments}
        onCreated={() => { setModalOpen(false); load(); }}
      />
    </div>
  );
}

function CreateTeamModal({
  open, onClose, people, departments, onCreated,
}: { open: boolean; onClose: () => void; people: Person[]; departments: Department[]; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", code: "", description: "", departmentId: "", leadUserId: "", hrUserId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof typeof form>(key: K, value: string) { setForm(f => ({ ...f, [key]: value })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        departmentId: form.departmentId || undefined,
        leadUserId: form.leadUserId || undefined,
        hrUserId: form.hrUserId || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    setForm({ name: "", code: "", description: "", departmentId: "", leadUserId: "", hrUserId: "" });
    onCreated();
  }

  const leadCandidates = people.filter(p => p.role === "TEAM_LEAD" || p.role === "SUPER_ADMIN");
  const hrCandidates = people.filter(p => p.role === "HR_MANAGER");

  return (
    <Modal open={open} onClose={onClose} title="Create team" wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && <div className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <label className="text-sm font-medium">Team name
          <input required value={form.name} onChange={e => update("name", e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Team code
          <input required value={form.code} onChange={e => update("code", e.target.value.toUpperCase())} placeholder="e.g. DEV" className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium sm:col-span-2">Description
          <textarea value={form.description} onChange={e => update("description", e.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Department
          <select value={form.departmentId} onChange={e => update("departmentId", e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5">
            <option value="">— None —</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <div />
        <label className="text-sm font-medium">Team Lead
          <select value={form.leadUserId} onChange={e => update("leadUserId", e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5">
            <option value="">— Unassigned —</option>
            {leadCandidates.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">HR representative
          <select value={form.hrUserId} onChange={e => update("hrUserId", e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5">
            <option value="">— Unassigned —</option>
            {hrCandidates.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        <div className="sm:col-span-2 mt-1 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button disabled={busy} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Creating…" : "Create team"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
