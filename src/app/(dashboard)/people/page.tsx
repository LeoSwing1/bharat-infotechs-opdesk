"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";

type Person = {
  id: string; name: string; email: string; role: string; status: string;
  employeeCode?: string | null; employmentType?: string | null; designation?: string | null;
  teamName?: string | null; departmentName?: string | null;
};
type Team = { id: string; name: string };
type Department = { id: string; name: string };
type Shift = { id: string; name: string };
type SessionUser = { id: string; role: string };

const ROLES = [
  { value: "HR_MANAGER", label: "HR Manager" },
  { value: "MANAGER", label: "Manager" },
  { value: "TEAM_LEAD", label: "Team Lead" },
  { value: "EMPLOYEE", label: "Employee" },
  { value: "INTERN_EMPLOYEE", label: "Intern" },
];
const EMPLOYMENT_TYPES = ["EMPLOYEE", "INTERN", "CONTRACT", "FREELANCER", "TRAINEE"];

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [peopleRes, teamsRes, deptRes, shiftsRes, meRes] = await Promise.all([
      fetch("/api/people"), fetch("/api/teams"), fetch("/api/departments"), fetch("/api/shifts"), fetch("/api/auth/me"),
    ]);
    const [peopleData, teamsData, deptData, shiftsData, meData] = await Promise.all([
      peopleRes.json(), teamsRes.json(), deptRes.json(), shiftsRes.json(), meRes.json(),
    ]);
    setPeople(peopleData.people ?? []);
    setTeams(teamsData.teams ?? []);
    setDepartments(deptData.departments ?? []);
    setShifts(shiftsData.shifts ?? []);
    setMe(meData.user ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return people;
    const q = search.toLowerCase();
    return people.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.employeeCode ?? "").toLowerCase().includes(q)
    );
  }, [people, search]);

  const canCreate = me?.role === "SUPER_ADMIN" || me?.role === "HR_MANAGER";
  const activeCount = people.filter(p => p.status === "ACTIVE").length;
  const teamCount = new Set(people.map(p => p.teamName).filter(Boolean)).size;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">People</h1>
          <p className="mt-1 text-gray-500">Manage employees, interns, roles, departments and profiles.</p>
        </div>
        {canCreate && (
          <button onClick={() => setModalOpen(true)} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
            + Add Person
          </button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-4"><div className="text-2xl font-bold">{loading ? "—" : people.length}</div><div className="text-sm text-gray-500">Total</div></div>
        <div className="card p-4"><div className="text-2xl font-bold">{loading ? "—" : activeCount}</div><div className="text-sm text-gray-500">Active</div></div>
        <div className="card p-4"><div className="text-2xl font-bold">{loading ? "—" : teamCount}</div><div className="text-sm text-gray-500">Teams represented</div></div>
      </div>

      <div className="card p-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email or employee ID…"
          className="mb-4 w-full max-w-sm rounded-xl border p-2.5 text-sm"
        />

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={people.length === 0 ? "No people yet" : "No matches"}
            description={people.length === 0 ? "Add your first employee or intern to get started." : "Try a different search term."}
            action={canCreate && people.length === 0 ? <button onClick={() => setModalOpen(true)} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">+ Add Person</button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Employee ID</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Team</th>
                  <th className="pb-3 font-medium">Department</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-3">
                      <Link href={`/people/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                      <div className="text-xs text-gray-500">{p.email}</div>
                    </td>
                    <td className="py-3 text-gray-600">{p.employeeCode ?? "—"}</td>
                    <td className="py-3 text-gray-600">{p.role.replace(/_/g, " ")}</td>
                    <td className="py-3 text-gray-600">{p.teamName ?? "—"}</td>
                    <td className="py-3 text-gray-600">{p.departmentName ?? "—"}</td>
                    <td className="py-3"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreatePersonModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        teams={teams}
        departments={departments}
        shifts={shifts}
        onCreated={() => { setModalOpen(false); load(); }}
      />
    </div>
  );
}

function CreatePersonModal({
  open, onClose, teams, departments, shifts, onCreated,
}: { open: boolean; onClose: () => void; teams: Team[]; departments: Department[]; shifts: Shift[]; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", role: "EMPLOYEE", employmentType: "EMPLOYEE",
    designation: "", departmentId: "", teamId: "", shiftId: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ employeeCode: string; email: string; temporaryPassword?: string; welcomeEmailSent?: boolean } | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) { setForm(f => ({ ...f, [key]: value })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        email: form.email || undefined,
        departmentId: form.departmentId || undefined,
        teamId: form.teamId || undefined,
        shiftId: form.shiftId || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    setResult({ employeeCode: data.person.employeeCode, email: data.person.email, temporaryPassword: data.temporaryPassword, welcomeEmailSent: data.welcomeEmailSent });
  }

  function handleClose() {
    setForm({ name: "", email: "", phone: "", role: "EMPLOYEE", employmentType: "EMPLOYEE", designation: "", departmentId: "", teamId: "", shiftId: "" });
    setResult(null); setError("");
    onClose();
  }

  if (result) {
    return (
      <Modal open={open} onClose={() => { handleClose(); onCreated(); }} title="Person created">
        <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">{form.name} was added successfully.</p>
          <p className="mt-2">Employee ID: <span className="font-mono font-semibold">{result.employeeCode}</span></p>
          <p className="mt-2">Login email: <span className="font-mono font-semibold">{result.email}</span></p>
          {result.temporaryPassword && (
            <p className="mt-2">Temporary password: <span className="font-mono font-semibold">{result.temporaryPassword}</span></p>
          )}
          <p className="mt-2 text-emerald-700/80">Share these credentials securely — they won&apos;t be shown again.</p>
        </div>
        {result.temporaryPassword && (
          result.welcomeEmailSent ? (
            <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
              A welcome email with these credentials was also sent to {result.email}.
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Email isn&apos;t configured on this server, so no welcome email was sent — please share the password above with {form.name} directly.
            </div>
          )
        )}
        <button onClick={() => { handleClose(); onCreated(); }} className="mt-5 w-full rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white">Done</button>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add person" wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && <div className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <label className="text-sm font-medium">Full name
          <input required value={form.name} onChange={e => update("name", e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Email <span className="font-normal text-gray-400">(optional — auto-generated if left blank)</span>
          <input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="Leave blank for firstname@bharatinfotechs.com" className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Phone
          <input value={form.phone} onChange={e => update("phone", e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Designation
          <input value={form.designation} onChange={e => update("designation", e.target.value)} placeholder="e.g. Software Engineer" className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Role
          <select value={form.role} onChange={e => update("role", e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5">
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Employment type
          <select value={form.employmentType} onChange={e => update("employmentType", e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5">
            {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Department
          <select value={form.departmentId} onChange={e => update("departmentId", e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5">
            <option value="">— None —</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Team
          <select value={form.teamId} onChange={e => update("teamId", e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5">
            <option value="">— None —</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Shift
          <select value={form.shiftId} onChange={e => update("shiftId", e.target.value)} className="mt-1.5 w-full rounded-xl border p-2.5">
            <option value="">— Default (9:30 AM) —</option>
            {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>

        <div className="sm:col-span-2 mt-1 flex justify-end gap-3">
          <button type="button" onClick={handleClose} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button disabled={busy} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Creating…" : "Create person"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
