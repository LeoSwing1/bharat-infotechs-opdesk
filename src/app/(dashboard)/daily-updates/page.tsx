"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";

type DailyUpdate = {
  id: string; userId: string; userName: string; updateDate: string;
  workedOn: string; completed: string | null; nextWork: string | null; blockers: string | null;
  status: string;
};
type SessionUser = { id: string; role: string };

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyUpdatesPage() {
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [updatesRes, meRes] = await Promise.all([fetch("/api/daily-updates"), fetch("/api/auth/me")]);
    const [updatesData, meData] = await Promise.all([updatesRes.json(), meRes.json()]);
    setUpdates(updatesData.updates ?? []);
    setMe(meData.user ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const today = todayString();
  const submittedToday = updates.some(u => u.userId === me?.id && u.updateDate === today);
  const isManagement = me?.role === "SUPER_ADMIN" || me?.role === "HR_MANAGER" || me?.role === "MANAGER" || me?.role === "MANAGER" || me?.role === "TEAM_LEAD";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Daily Updates</h1>
          <p className="mt-1 text-gray-500">What you worked on, what's next, and any blockers.</p>
        </div>
        {!submittedToday && (
          <button onClick={() => setModalOpen(true)} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
            + Submit Today's Update
          </button>
        )}
      </div>

      {submittedToday && (
        <div className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          You've submitted your update for today. Nice work.
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-lg font-bold">{isManagement ? "Team Updates" : "My Updates"}</h2>
        {loading ? (
          <div className="mt-4 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}</div>
        ) : updates.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No updates yet" description="Submit your first daily update to start building a history." />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {updates.map(u => (
              <div key={u.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{isManagement ? u.userName : u.updateDate}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {isManagement && <span>{u.updateDate}</span>}
                    <StatusBadge status={u.status} />
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-700"><span className="font-medium text-gray-500">Worked on: </span>{u.workedOn}</p>
                {u.completed && <p className="mt-1 text-sm text-gray-700"><span className="font-medium text-gray-500">Completed: </span>{u.completed}</p>}
                {u.nextWork && <p className="mt-1 text-sm text-gray-700"><span className="font-medium text-gray-500">Next: </span>{u.nextWork}</p>}
                {u.blockers && <p className="mt-1 text-sm text-red-600"><span className="font-medium">Blockers: </span>{u.blockers}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <SubmitUpdateModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmitted={() => { setModalOpen(false); load(); }} />
    </div>
  );
}

function SubmitUpdateModal({ open, onClose, onSubmitted }: { open: boolean; onClose: () => void; onSubmitted: () => void }) {
  const [form, setForm] = useState({ workedOn: "", completed: "", nextWork: "", blockers: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/daily-updates", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    setForm({ workedOn: "", completed: "", nextWork: "", blockers: "" });
    onSubmitted();
  }

  return (
    <Modal open={open} onClose={onClose} title="Submit today's update" wide>
      <form onSubmit={submit} className="grid gap-4">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="text-sm font-medium">What did you work on? *
          <textarea required value={form.workedOn} onChange={e => setForm(f => ({ ...f, workedOn: e.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">What did you complete?
          <textarea value={form.completed} onChange={e => setForm(f => ({ ...f, completed: e.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">What's next?
          <textarea value={form.nextWork} onChange={e => setForm(f => ({ ...f, nextWork: e.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Blockers (if any)
          <textarea value={form.blockers} onChange={e => setForm(f => ({ ...f, blockers: e.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <div className="mt-1 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button disabled={busy} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Submitting…" : "Submit update"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
