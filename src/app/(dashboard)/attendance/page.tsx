"use client";
import { useEffect, useState, useCallback } from "react";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";

type TodayStatus = {
  available: boolean;
  clockedIn?: boolean;
  onBreak?: boolean;
  liveWorkedMinutes?: number | null;
  liveBreakMinutes?: number;
  row?: { status: string; clockInAt: string | null; clockOutAt: string | null } | null;
  error?: string;
  events?: { type: string; occurredAt: string; note?: string | null }[];
  shift?: { name: string; startTime: string; endTime: string; gracePeriodMinutes: number } | null;
  lateMinutes?: number;
};
type AttendanceRecord = {
  id: string; userId: string; attendanceDate: string; status: string;
  clockInAt: string | null; clockOutAt: string | null; breakMinutes: number; workedMinutes: number | null;
};
type SessionUser = { id: string; role: string };

function formatMinutes(min?: number | null) {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AttendancePage() {
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    const [todayRes, historyRes, meRes] = await Promise.all([
      fetch("/api/attendance/today"), fetch("/api/attendance"), fetch("/api/auth/me"),
    ]);
    const [todayData, historyData, meData] = await Promise.all([todayRes.json(), historyRes.json(), meRes.json()]);
    setToday(todayData);
    setHistory(historyData.records ?? []);
    setMe(meData.user ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Keep the displayed work/break totals moving between API refreshes.
  useEffect(() => {
    if (!today?.clockedIn) return;
    const interval = setInterval(() => {
      setToday(t => {
        if (!t?.clockedIn) return t;
        return {
          ...t,
          liveWorkedMinutes: (t.liveWorkedMinutes ?? 0) + (t.onBreak ? 0 : 1),
          liveBreakMinutes: (t.liveBreakMinutes ?? 0) + (t.onBreak ? 1 : 0),
        };
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [today?.clockedIn, today?.onBreak]);

  async function runAction(path: string) {
    setActionBusy(true); setActionError("");
    const res = await fetch(path, { method: "POST" });
    const data = await res.json();
    setActionBusy(false);
    if (!res.ok) { setActionError(data.error ?? "Something went wrong"); return; }
    load();
  }

  const isSelfHistory = history.length === 0 || history.every(r => r.userId === me?.id);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Attendance</h1>
        <p className="mt-1 text-gray-500">Clock in, track breaks, and review your attendance history.</p>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
      ) : !today?.available ? (
        <EmptyState title="Attendance needs a database" description="Connect PostgreSQL and disable demo mode to use live clock in/out." />
      ) : (
        <>
          <div className="card p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm text-gray-500">Today</div>
                <div className="mt-1 text-3xl font-bold">{formatMinutes(today.liveWorkedMinutes)}</div>
                <div className="mt-1 text-sm text-gray-500">
                  Break: {formatMinutes(today.liveBreakMinutes)}
                  {today.row?.status && <> · <StatusBadge status={today.row.status} /></>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!today.clockedIn ? (
                  <button onClick={() => runAction("/api/attendance/clock-in")} disabled={actionBusy}
                    className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    Clock In
                  </button>
                ) : (
                  <>
                    {!today.onBreak ? (
                      <button onClick={() => runAction("/api/attendance/break-start")} disabled={actionBusy}
                        className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                        Start Break
                      </button>
                    ) : (
                      <button onClick={() => runAction("/api/attendance/break-end")} disabled={actionBusy}
                        className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                        End Break
                      </button>
                    )}
                    <button onClick={() => runAction("/api/attendance/clock-out")} disabled={actionBusy}
                      className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                      Clock Out
                    </button>
                  </>
                )}
              </div>
            </div>
            {actionError && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}
            {today.row?.clockInAt && (
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 p-3"><div className="text-xs text-gray-500">Clock in</div><div className="mt-1 font-semibold">{formatTime(today.row.clockInAt)}</div></div>
                <div className="rounded-xl bg-gray-50 p-3"><div className="text-xs text-gray-500">Clock out</div><div className="mt-1 font-semibold">{formatTime(today.row.clockOutAt)}</div></div>
              </div>
            )}
            {today.onBreak && <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Break is running. Worked time pauses until you end the break.</div>}
            {today.shift && <div className="mt-4 rounded-xl border bg-white p-4 text-sm"><div className="font-semibold">{today.shift.name}</div><div className="mt-1 text-gray-500">{today.shift.startTime} – {today.shift.endTime} · {today.shift.gracePeriodMinutes} min grace{(today.lateMinutes ?? 0) > 0 ? ` · ${today.lateMinutes} min late` : ''}</div></div>}
            {today.events && today.events.length > 0 && <div className="mt-5"><h3 className="text-sm font-bold">Today’s timeline</h3><div className="mt-2 space-y-2">{today.events.map((event, index) => <div key={`${event.type}-${event.occurredAt}-${index}`} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm"><span className="font-medium">{event.type.replaceAll('_', ' ')}</span><span className="text-gray-500">{formatTime(event.occurredAt)}</span></div>)}</div></div>}
          </div>

          <div className="card mt-5 p-6">
            <h2 className="text-lg font-bold">{isSelfHistory ? "My History" : "Attendance"}</h2>
            {history.length === 0 ? (
              <div className="mt-4"><EmptyState title="No attendance records yet" description="Clock in above to start building your history." /></div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">In</th>
                      <th className="pb-3 font-medium">Out</th>
                      <th className="pb-3 font-medium">Break</th>
                      <th className="pb-3 font-medium">Worked</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(r => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-3">{r.attendanceDate}</td>
                        <td className="py-3 text-gray-600">{formatTime(r.clockInAt)}</td>
                        <td className="py-3 text-gray-600">{formatTime(r.clockOutAt)}</td>
                        <td className="py-3 text-gray-600">{formatMinutes(r.breakMinutes)}</td>
                        <td className="py-3 text-gray-600">{formatMinutes(r.workedMinutes)}</td>
                        <td className="py-3"><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
