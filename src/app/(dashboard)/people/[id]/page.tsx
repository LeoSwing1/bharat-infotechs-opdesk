"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import Modal from "@/components/ui/Modal";

type Person = {
  id: string; name: string; email: string; phone?: string | null; role: string; status: string;
  employeeCode?: string | null; employmentType?: string | null; designation?: string | null;
  teamName?: string | null; departmentName?: string | null; joiningDate?: string | null;
};
type SessionUser = { id: string; role: string };

export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [person, setPerson] = useState<Person | null>(null);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetResult, setResetResult] = useState<{ temporaryPassword: string; emailSent: boolean } | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");

  async function load() {
    setLoading(true); setError("");
    const [res, meRes] = await Promise.all([fetch(`/api/people/${id}`), fetch("/api/auth/me")]);
    const data = await res.json();
    const meData = await meRes.json();
    if (!res.ok) { setError(data.error ?? "Could not load this profile"); setLoading(false); return; }
    setPerson(data.person);
    setMe(meData.user ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function toggleStatus() {
    if (!person) return;
    const nextStatus = person.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setBusy(true);
    const res = await fetch(`/api/people/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setBusy(false);
    if (res.ok) load();
  }

  async function resetPassword() {
    setResetBusy(true); setResetError("");
    const res = await fetch(`/api/people/${id}/reset-password`, { method: "POST" });
    const data = await res.json();
    setResetBusy(false);
    if (!res.ok) { setResetError(data.error ?? "Something went wrong"); return; }
    setResetResult(data);
  }

  const canDeactivate = me?.role === "SUPER_ADMIN" || me?.role === "HR_MANAGER" || me?.role === "MANAGER";
  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  if (error) return <div className="card p-8 text-sm text-red-700">{error}</div>;
  if (!person) return null;

  return (
    <div>
      <Link href="/people" className="text-sm text-gray-500 hover:text-gray-800">← Back to People</Link>

      <div className="card mt-4 p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{person.name}</h1>
            <p className="mt-1 text-gray-500">{person.designation ?? person.role.replace(/_/g, " ")}</p>
            <div className="mt-3"><StatusBadge status={person.status} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isSuperAdmin && (
              <button
                onClick={() => { setResetOpen(true); setResetResult(null); setResetError(""); }}
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
              >
                Reset Password
              </button>
            )}
            {canDeactivate && (
              <button
                onClick={toggleStatus}
                disabled={busy}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                  person.status === "ACTIVE" ? "border border-red-200 text-red-700 hover:bg-red-50" : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                {busy ? "Saving…" : person.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Employee ID" value={person.employeeCode ?? "—"} mono />
          <Field label="Email" value={person.email} />
          <Field label="Phone" value={person.phone ?? "—"} />
          <Field label="Role" value={person.role.replace(/_/g, " ")} />
          <Field label="Employment type" value={person.employmentType ?? "—"} />
          <Field label="Team" value={person.teamName ?? "—"} />
          <Field label="Department" value={person.departmentName ?? "—"} />
          <Field label="Joining date" value={person.joiningDate ?? "—"} />
        </div>
      </div>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset password">
        {resetResult ? (
          <div>
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">Password reset for {person.name}.</p>
              <p className="mt-2">New temporary password: <span className="font-mono font-semibold">{resetResult.temporaryPassword}</span></p>
              <p className="mt-2 text-emerald-700/80">Shown once — it won&apos;t be shown again.</p>
            </div>
            <div className={`mt-3 rounded-xl p-3 text-sm ${resetResult.emailSent ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"}`}>
              {resetResult.emailSent
                ? `An email with the new password was also sent to ${person.email}.`
                : `Email isn't configured on this server — please share the password above with ${person.name} directly.`}
            </div>
            <button onClick={() => setResetOpen(false)} className="mt-5 w-full rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white">Done</button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600">
              This immediately invalidates {person.name}&apos;s current password and generates a new temporary one. They&apos;ll need it (or the email, if configured) to sign in again.
            </p>
            {resetError && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{resetError}</div>}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setResetOpen(false)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button>
              <button onClick={resetPassword} disabled={resetBusy} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {resetBusy ? "Resetting…" : "Reset password"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`mt-1 text-sm text-gray-800 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
