"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";

type Task = {
  id: string; title: string; description?: string | null; priority: string; status: string;
  assigneeId: string | null; creatorId: string | null; teamId: string | null;
  deadline: string | null; rejectionReason: string | null;
};
type Comment = { id: string; authorId: string; message: string; createdAt: string };
type Submission = { id: string; submittedBy: string; notes: string | null; createdAt: string };
type SessionUser = { id: string; role: string };

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [comment, setComment] = useState("");

  async function load() {
    setError("");
    const [res, meRes] = await Promise.all([fetch(`/api/tasks/${id}`), fetch("/api/auth/me")]);
    const data = await res.json();
    const meData = await meRes.json();
    if (!res.ok) { setError(data.error ?? "Could not load this task"); setLoading(false); return; }
    setTask(data.task);
    setComments(data.comments ?? []);
    setSubmissions(data.submissions ?? []);
    setMe(meData.user ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function runAction(action: string, requireComment?: boolean) {
    if (requireComment && !comment.trim()) { setActionError("Please provide a reason."); return; }
    setBusy(true); setActionError("");
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment: comment.trim() || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setActionError(data.error ?? "Something went wrong"); return; }
    setComment("");
    load();
  }

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  if (error) return <div className="card p-8 text-sm text-red-700">{error}</div>;
  if (!task) return null;

  const isAssignee = task.assigneeId === me?.id;
  const canReview = me?.role === "SUPER_ADMIN" || me?.role === "TEAM_LEAD" || me?.role === "HR_MANAGER" || task.creatorId === me?.id;

  return (
    <div>
      <Link href="/tasks" className="text-sm text-gray-500 hover:text-gray-800">← Back to Tasks</Link>

      <div className="card mt-4 p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{task.title}</h1>
            {task.description && <p className="mt-2 text-sm text-gray-600">{task.description}</p>}
          </div>
          <StatusBadge status={task.status} />
        </div>

        {task.deadline && <p className="mt-4 text-sm text-gray-500">Deadline: {new Date(task.deadline).toLocaleString()}</p>}
        {task.rejectionReason && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Rejection reason: {task.rejectionReason}</div>
        )}

        {actionError && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}

        <div className="mt-6 flex flex-wrap gap-2">
          {isAssignee && task.status === "ASSIGNED" && (
            <button onClick={() => runAction("START")} disabled={busy} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Start Task</button>
          )}
          {isAssignee && task.status === "STARTED" && (
            <button onClick={() => runAction("SUBMIT")} disabled={busy} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Submit for Review</button>
          )}
          {isAssignee && task.status === "REJECTED" && (
            <button onClick={() => runAction("REOPEN")} disabled={busy} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Reopen & Rework</button>
          )}
          {canReview && (task.status === "SUBMITTED" || task.status === "UNDER_REVIEW") && (
            <>
              <button onClick={() => runAction("APPROVE")} disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Approve</button>
              <button onClick={() => runAction("REJECT", true)} disabled={busy} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">Reject</button>
            </>
          )}
        </div>

        {canReview && (task.status === "SUBMITTED" || task.status === "UNDER_REVIEW") && (
          <textarea
            value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Comment or rejection reason…"
            rows={2} className="mt-3 w-full rounded-xl border p-2.5 text-sm"
          />
        )}
      </div>

      <div className="card mt-5 p-6">
        <h2 className="text-lg font-bold">Activity</h2>
        {submissions.length === 0 && comments.length === 0 ? (
          <div className="mt-3"><EmptyState title="No activity yet" /></div>
        ) : (
          <div className="mt-3 space-y-3">
            {submissions.map(s => (
              <div key={s.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                <div className="font-medium text-gray-700">Submitted for review</div>
                {s.notes && <p className="mt-1 text-gray-600">{s.notes}</p>}
                <div className="mt-1 text-xs text-gray-400">{new Date(s.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {comments.map(c => (
              <div key={c.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                <p className="text-gray-600">{c.message}</p>
                <div className="mt-1 text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
