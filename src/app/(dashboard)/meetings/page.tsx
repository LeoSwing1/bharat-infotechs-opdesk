"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";

type Meeting = {
  id: string; title: string; description?: string | null; organizerName: string | null;
  teamName?: string | null; startAt: string; endAt: string; meetingLink?: string | null;
  status: string; participantCount: number;
};
type Person = { id: string; name: string };
type Team = { id: string; name: string };

function formatRange(start: string, end: string) {
  const s = new Date(start), e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const dateFmt: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return sameDay
    ? `${s.toLocaleDateString([], dateFmt)} · ${s.toLocaleTimeString([], timeFmt)}–${e.toLocaleTimeString([], timeFmt)}`
    : `${s.toLocaleString([], { ...dateFmt, ...timeFmt })} – ${e.toLocaleString([], { ...dateFmt, ...timeFmt })}`;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [meetingsRes, peopleRes, teamsRes] = await Promise.all([
      fetch("/api/meetings?upcoming=true"), fetch("/api/people"), fetch("/api/teams"),
    ]);
    const [meetingsData, peopleData, teamsData] = await Promise.all([meetingsRes.json(), peopleRes.json(), teamsRes.json()]);
    setMeetings(meetingsData.meetings ?? []);
    setPeople(peopleData.people ?? []);
    setTeams(teamsData.teams ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Meetings</h1>
          <p className="mt-1 text-gray-500">Schedule, agenda, and follow-up in one place.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
          + Schedule Meeting
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100" />)}</div>
      ) : meetings.length === 0 ? (
        <EmptyState
          title="No upcoming meetings"
          description="Schedule your first meeting to get started."
          action={<button onClick={() => setModalOpen(true)} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">+ Schedule Meeting</button>}
        />
      ) : (
        <div className="space-y-3">
          {meetings.map(m => (
            <Link key={m.id} href={`/meetings/${m.id}`} className="card block p-5 transition hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{m.title}</div>
                  <div className="mt-1 text-sm text-gray-500">{formatRange(m.startAt, m.endAt)}</div>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{m.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                <span>Organizer: {m.organizerName ?? "—"}</span>
                {m.teamName && <span>Team: {m.teamName}</span>}
                <span>{m.participantCount} participant{m.participantCount === 1 ? "" : "s"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateMeetingModal open={modalOpen} onClose={() => setModalOpen(false)} people={people} teams={teams} onCreated={() => { setModalOpen(false); load(); }} />
    </div>
  );
}

function CreateMeetingModal({
  open, onClose, people, teams, onCreated,
}: { open: boolean; onClose: () => void; people: Person[]; teams: Team[]; onCreated: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", teamId: "", startAt: "", endAt: "", meetingLink: "", agenda: "" });
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggleParticipant(id: string) {
    setParticipantIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/meetings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        teamId: form.teamId || undefined,
        meetingLink: form.meetingLink || undefined,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
        participantIds,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    setForm({ title: "", description: "", teamId: "", startAt: "", endAt: "", meetingLink: "", agenda: "" });
    setParticipantIds([]);
    onCreated();
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule meeting" wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && <div className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="text-sm font-medium sm:col-span-2">Title
          <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Start
          <input required type="datetime-local" value={form.startAt} onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">End
          <input required type="datetime-local" value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium">Team (optional)
          <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} className="mt-1.5 w-full rounded-xl border p-2.5">
            <option value="">— None —</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Meeting link (optional)
          <input value={form.meetingLink} onChange={e => setForm(f => ({ ...f, meetingLink: e.target.value }))} placeholder="https://meet.google.com/..." className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <label className="text-sm font-medium sm:col-span-2">Agenda
          <textarea value={form.agenda} onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border p-2.5" />
        </label>
        <div className="sm:col-span-2">
          <div className="text-sm font-medium">Participants</div>
          <div className="mt-1.5 flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-xl border p-2.5">
            {people.map(p => (
              <button
                type="button" key={p.id} onClick={() => toggleParticipant(p.id)}
                className={`rounded-full px-3 py-1.5 text-sm ${participantIds.includes(p.id) ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2 mt-1 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button disabled={busy} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Scheduling…" : "Schedule meeting"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
