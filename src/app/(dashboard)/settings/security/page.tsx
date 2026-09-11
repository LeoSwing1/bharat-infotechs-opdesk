"use client";
import { useState } from "react";

export default function SecuritySettingsPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(false);

    if (next !== confirm) { setError("New passwords don't match"); return; }
    if (next.length < 8) { setError("New password must be at least 8 characters"); return; }

    setBusy(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    setSuccess(true);
    setCurrent(""); setNext(""); setConfirm("");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Security</h1>
      <p className="mt-2 text-gray-500">Change your password. If this is your first login, replace the temporary password you were given.</p>

      <div className="card mt-6 max-w-md p-6">
        <form onSubmit={submit} className="grid gap-4">
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Password updated.</div>}

          <label className="text-sm font-medium">Current password
            <input required type="password" value={current} onChange={e => setCurrent(e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5" />
          </label>
          <label className="text-sm font-medium">New password
            <input required type="password" value={next} onChange={e => setNext(e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5" />
          </label>
          <label className="text-sm font-medium">Confirm new password
            <input required type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5" />
          </label>

          <button disabled={busy} className="mt-1 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
