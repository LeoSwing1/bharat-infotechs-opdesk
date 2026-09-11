"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";

type Project = {
  id: string; name: string; description?: string | null; kind: string; clientName?: string | null;
  status: string; teamId?: string | null; teamName?: string | null; managerId?: string | null; managerName?: string | null;
};
type Team = { id: string; name: string };
type Person = { id: string; name: string };
type SessionUser = { id: string; role: string };

const STATUS_TONE: Record<string, string> = {
  PLANNING: "bg-gray-100 text-gray-600",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  ON_HOLD: "bg-amber-50 text-amber-700",
  IN_REVIEW: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [projRes, teamsRes, peopleRes, meRes] = await Promise.all([
      fetch("/api/projects"), fetch("/api/teams"), fetch("/api/people"), fetch("/api/auth/me"),
    ]);
    const [projData, teamsData, peopleData, meData] = await Promise.all([projRes.json(), teamsRes.json(), peopleRes.json(), meRes.json()]);
    setProjects(projData.projects ?? []);
    setTeams(teamsData.teams ?? []);
    setPeople(peopleData.people ?? []);
    setMe(meData.user ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const canCreate = me?.role === "SUPER_ADMIN" || me?.role === "TEAM_LEAD";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="mt-1 text-gray-500">Track internal and client work, organized by team.</p>
        </div>
        {canCreate && (
          <button onClick={() => setModalOpen(true)} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
            + New Project
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start organizing assignments and tasks."
          action={canCreate ? <button onClick={() => setModalOpen(true)} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">+ New Project</button> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map(p => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card block p-5 transition hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{p.name}</div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {p.status.replace(/_/g, " ")}
                </span>
              </div>
              {p.description && <p className="mt-2 line-clamp-2 text-sm text-gray-500">{p.description}</p>}
              <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                <span>{p.teamName ?? "No team"}</span>
                <span>{p.kind === "CLIENT" ? p.clientName ?? "Client" : "Internal"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateProjectModal
        open={modalOpen} onClose={() => setModalOpen(false)}
        teams={teams} people={people}
        onCreated={() => { setModalOpen(false); load(); }}
      />
    </div>
  );
}

function CreateProjectModal({
  open, onClose, teams, people, onCreated,
}: { open: boolean; onClose: () => void; teams: Team[]; people: Person[]; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", kind: "INTERNAL", clientName: "", teamId: "", managerId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        clientName: form.clientName || undefined,
        teamId: form.teamId || undefined,
        managerId: form.managerId || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    setForm({ name: "", description: "", kind: "INTERNAL", clientName: "", teamId: "", managerId: "" });
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="New project" wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && <div className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="text-sm font-medium sm:col-span-2">Project name
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium sm:col-span-2">Description
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Type
          <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} className="mt-1.5 w-full rounded-xl border p-2.5">
            <option value="INTERNAL">Internal</option>
            <option value="CLIENT">Client</option>
          </select>
        </label>
        {form.kind === "CLIENT" && (
          <label className="text-sm font-medium">Client name
            <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className="mt-1.5 w-full rounded-xl border p-2.5" />
          </label>
        )}
        <label className="text-sm font-medium">Team
          <select required value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} className="mt-1.5 w-full rounded-xl border p-2.5">
            <option value="">— Select a team —</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Project manager
          <select value={form.managerId} onChange={e => setForm(f => ({ ...f, managerId: e.target.value }))} className="mt-1.5 w-full rounded-xl border p-2.5">
            <option value="">— Me —</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="sm:col-span-2 mt-1 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button disabled={busy} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
