"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";

type Shift = { id: string; name: string; code: string; startTime: string; endTime: string; gracePeriodMinutes: number; active: boolean };
type SessionUser = { role: string };

export default function ShiftsSettingsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [shiftsRes, meRes] = await Promise.all([fetch("/api/shifts"), fetch("/api/auth/me")]);
    const [shiftsData, meData] = await Promise.all([shiftsRes.json(), meRes.json()]);
    setShifts(shiftsData.shifts ?? []);
    setMe(meData.user ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const canManage = me?.role === "SUPER_ADMIN" || me?.role === "HR_MANAGER" || me?.role === "MANAGER";

  async function toggleActive(shift: Shift) {
    await fetch(`/api/shifts/${shift.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !shift.active }),
    });
    load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Shifts</h1>
          <p className="mt-1 text-gray-500">Define shift schedules to determine expected start times and overtime.</p>
        </div>
        {canManage && (
          <button onClick={() => setModalOpen(true)} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
            + Add Shift
          </button>
        )}
      </div>

      <div className="card p-5">
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />)}</div>
        ) : shifts.length === 0 ? (
          <EmptyState
            title="No shifts defined"
            description="Without a shift, people default to a 9:30 AM start with a 15-minute grace period."
            action={canManage ? <button onClick={() => setModalOpen(true)} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">+ Add Shift</button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Code</th>
                  <th className="pb-3 font-medium">Start</th>
                  <th className="pb-3 font-medium">End</th>
                  <th className="pb-3 font-medium">Grace</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map(s => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{s.name}</td>
                    <td className="py-3 text-gray-600">{s.code}</td>
                    <td className="py-3 text-gray-600">{s.startTime.slice(0, 5)}</td>
                    <td className="py-3 text-gray-600">{s.endTime.slice(0, 5)}</td>
                    <td className="py-3 text-gray-600">{s.gracePeriodMinutes}m</td>
                    <td className="py-3">
                      {canManage ? (
                        <button onClick={() => toggleActive(s)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {s.active ? "Active" : "Archived"}
                        </button>
                      ) : (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {s.active ? "Active" : "Archived"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateShiftModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />
    </div>
  );
}

function CreateShiftModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", code: "", startTime: "09:30", endTime: "18:00", gracePeriodMinutes: 15 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/shifts", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    setForm({ name: "", code: "", startTime: "09:30", endTime: "18:00", gracePeriodMinutes: 15 });
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add shift">
      <form onSubmit={submit} className="grid gap-4">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="text-sm font-medium">Shift name
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. General Shift" className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Shift code
          <input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. GEN" className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-medium">Start time
            <input required type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="mt-1.5 w-full rounded-xl border p-2.5" />
          </label>
          <label className="text-sm font-medium">End time
            <input required type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="mt-1.5 w-full rounded-xl border p-2.5" />
          </label>
        </div>
        <label className="text-sm font-medium">Grace period (minutes)
          <input type="number" min={0} max={120} value={form.gracePeriodMinutes} onChange={e => setForm(f => ({ ...f, gracePeriodMinutes: Number(e.target.value) }))} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <div className="mt-1 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button disabled={busy} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Creating…" : "Create shift"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
