"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";

type Meeting = {
  id: string; title: string; description?: string | null; organizerId: string;
  teamId: string | null; startAt: string; endAt: string; meetingLink?: string | null;
  agenda?: string | null; notes?: string | null; status: string;
};
type Participant = { id: string; name: string; email: string };
type SessionUser = { id: string; role: string };

const STATUSES = ["SCHEDULED", "STARTED", "COMPLETED", "CANCELLED"];

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");
    const [res, meRes] = await Promise.all([fetch(`/api/meetings/${id}`), fetch("/api/auth/me")]);
    const data = await res.json();
    const meData = await meRes.json();
    if (!res.ok) { setError(data.error ?? "Could not load this meeting"); setLoading(false); return; }
    setMeeting(data.meeting);
    setParticipants(data.participants ?? []);
    setNotes(data.meeting.notes ?? "");
    setMe(meData.user ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function updateStatus(status: string) {
    await fetch(`/api/meetings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  async function saveNotes() {
    setSaving(true);
    await fetch(`/api/meetings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes }) });
    setSaving(false);
  }

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  if (error) return <div className="card p-8 text-sm text-red-700">{error}</div>;
  if (!meeting) return null;

  const isOrganizer = meeting.organizerId === me?.id || me?.role === "SUPER_ADMIN";

  return (
    <div>
      <Link href="/meetings" className="text-sm text-gray-500 hover:text-gray-800">← Back to Meetings</Link>

      <div className="card mt-4 p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{meeting.title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {new Date(meeting.startAt).toLocaleString()} – {new Date(meeting.endAt).toLocaleString()}
            </p>
          </div>
          {isOrganizer ? (
            <select value={meeting.status} onChange={e => updateStatus(e.target.value)} className="rounded-xl border p-2 text-sm font-medium">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium">{meeting.status}</span>
          )}
        </div>

        {meeting.description && <p className="mt-4 text-sm text-gray-600">{meeting.description}</p>}
        {meeting.meetingLink && (
          <a href={meeting.meetingLink} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
            Join meeting →
          </a>
        )}
        {meeting.agenda && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-700">Agenda</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{meeting.agenda}</p>
          </div>
        )}
      </div>

      <div className="card mt-5 p-6">
        <h2 className="text-lg font-bold">Participants ({participants.length})</h2>
        {participants.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No participants invited.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {participants.map(p => <span key={p.id} className="rounded-full bg-gray-100 px-3 py-1.5 text-sm">{p.name}</span>)}
          </div>
        )}
      </div>

      {isOrganizer && (
        <div className="card mt-5 p-6">
          <h2 className="text-lg font-bold">Meeting Notes</h2>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notes, decisions, and action items…"
            rows={5} className="mt-3 w-full rounded-xl border p-2.5 text-sm"
          />
          <button onClick={saveNotes} disabled={saving} className="mt-3 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save Notes"}
          </button>
        </div>
      )}
    </div>
  );
}
