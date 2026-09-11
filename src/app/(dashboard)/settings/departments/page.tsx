"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";

type Department = { id: string; name: string; description: string | null; peopleCount: number; teamCount: number };
type SessionUser = { role: string };

export default function DepartmentsSettingsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  async function load() {
    setLoading(true);
    const [res, meRes] = await Promise.all([fetch("/api/departments"), fetch("/api/auth/me")]);
    const [data, meData] = await Promise.all([res.json(), meRes.json()]);
    setDepartments(data.departments ?? []);
    setMe(meData.user ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const canManage = me?.role === "SUPER_ADMIN";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Departments</h1>
          <p className="mt-1 text-gray-500">Organizational structure used across People and Teams.</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
            + Add Department
          </button>
        )}
      </div>

      <div className="card p-5">
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />)}</div>
        ) : departments.length === 0 ? (
          <EmptyState
            title="No departments yet"
            description="Departments group teams and people for reporting and organization."
            action={canManage ? <button onClick={() => setModalOpen(true)} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">+ Add Department</button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">People</th>
                  <th className="pb-3 font-medium">Teams</th>
                  {canManage && <th className="pb-3 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {departments.map(d => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{d.name}</td>
                    <td className="py-3 text-gray-600">{d.description ?? "—"}</td>
                    <td className="py-3 text-gray-600">{d.peopleCount}</td>
                    <td className="py-3 text-gray-600">{d.teamCount}</td>
                    {canManage && (
                      <td className="py-3 text-right">
                        <button onClick={() => { setEditing(d); setModalOpen(true); }} className="text-xs font-semibold text-gray-600 hover:underline">Edit</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DepartmentModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} onSaved={() => { setModalOpen(false); load(); }} />
    </div>
  );
}

function DepartmentModal({
  open, onClose, editing, onSaved,
}: { open: boolean; onClose: () => void; editing: Department | null; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) setForm({ name: editing?.name ?? "", description: editing?.description ?? "" });
  }, [open, editing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch(editing ? `/api/departments/${editing.id}` : "/api/departments", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit department" : "Add department"}>
      <form onSubmit={submit} className="grid gap-4">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="text-sm font-medium">Name
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Description
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <div className="mt-1 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button disabled={busy} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Saving…" : editing ? "Save changes" : "Create department"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
