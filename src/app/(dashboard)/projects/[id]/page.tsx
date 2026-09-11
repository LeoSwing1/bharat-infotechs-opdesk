"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";

type Project = {
  id: string; name: string; description?: string | null; status: string; kind: string;
  clientName?: string | null; teamId?: string | null; teamName?: string | null;
  managerName?: string | null; startDate?: string | null; endDate?: string | null;
};
type Assignment = { id: string; name: string; status: string; deadline: string | null; ownerId: string | null; ownerName: string | null; taskTotal: number; taskCompleted: number };
type Member = { id: string; name: string; email: string; role: string };
type Person = { id: string; name: string };
type TaskStats = { total: number; completed: number; overdue: number; progress: number };

const STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "IN_REVIEW", "COMPLETED", "ARCHIVED"];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setError("");
    const [res, peopleRes] = await Promise.all([fetch(`/api/projects/${id}`), fetch("/api/people")]);
    const data = await res.json();
    const peopleData = await peopleRes.json();
    if (!res.ok) { setError(data.error ?? "Could not load this project"); setLoading(false); return; }
    setProject(data.project);
    setAssignments(data.assignments ?? []);
    setMembers(data.members ?? []);
    setTaskStats(data.taskStats ?? null);
    setAllPeople(peopleData.people ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function updateStatus(status: string) {
    await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  if (error) return <div className="card p-8 text-sm text-red-700">{error}</div>;
  if (!project) return null;

  return (
    <div>
      <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-800">← Back to Projects</Link>

      <div className="card mt-4 p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {project.teamName ?? "No team"} · {project.kind === "CLIENT" ? project.clientName ?? "Client" : "Internal"} · Manager: {project.managerName ?? "—"}
            </p>
          </div>
          <select value={project.status} onChange={e => updateStatus(e.target.value)} className="rounded-xl border p-2 text-sm font-medium">
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        {project.description && <p className="mt-4 text-sm text-gray-600">{project.description}</p>}

        {taskStats && (
          <div className="mt-6">
            <div className="flex justify-between text-sm text-gray-500">
              <span>{taskStats.completed} of {taskStats.total} tasks complete</span>
              <span>{taskStats.progress}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-gray-900" style={{ width: `${taskStats.progress}%` }} />
            </div>
            {taskStats.overdue > 0 && <p className="mt-2 text-sm text-red-600">{taskStats.overdue} overdue task{taskStats.overdue === 1 ? "" : "s"}</p>}
          </div>
        )}
      </div>

      <div className="card mt-5 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Assignments</h2>
          <button onClick={() => setModalOpen(true)} className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white">+ Add Assignment</button>
        </div>
        {assignments.length === 0 ? (
          <EmptyState title="No assignments yet" description="Break this project into assignments, then tasks under each." />
        ) : (
          <div className="space-y-2">
            {assignments.map(a => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-gray-500">{a.taskCompleted}/{a.taskTotal} tasks · Owner: {a.ownerName ?? "Unassigned"}</div>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{a.status.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mt-5 p-6">
        <h2 className="text-lg font-bold">Members ({members.length})</h2>
        {members.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No members added yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {members.map(m => (
              <span key={m.id} className="rounded-full bg-gray-100 px-3 py-1.5 text-sm">{m.name}</span>
            ))}
          </div>
        )}
      </div>

      <CreateAssignmentModal open={modalOpen} onClose={() => setModalOpen(false)} projectId={id} people={allPeople} onCreated={() => { setModalOpen(false); load(); }} />
    </div>
  );
}

function CreateAssignmentModal({
  open, onClose, projectId, people, onCreated,
}: { open: boolean; onClose: () => void; projectId: string; people: Person[]; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", ownerId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/assignments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...form, ownerId: form.ownerId || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    setForm({ name: "", description: "", ownerId: "" });
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add assignment">
      <form onSubmit={submit} className="grid gap-4">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="text-sm font-medium">Assignment name
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Homepage Development" className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Description
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Owner
          <select value={form.ownerId} onChange={e => setForm(f => ({ ...f, ownerId: e.target.value }))} className="mt-1.5 w-full rounded-xl border p-2.5">
            <option value="">— Unassigned —</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="mt-1 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button disabled={busy} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Creating…" : "Create assignment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
