"use client";
import { useEffect, useState } from "react";
import { getPushStatus, enablePushNotifications, disablePushNotifications } from "@/lib/push-client";

type Status = "loading" | "unsupported" | "denied" | "subscribed" | "not-subscribed";

export default function NotificationsSettingsPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { getPushStatus().then(setStatus); }, []);

  async function enable() {
    setBusy(true); setError("");
    const result = await enablePushNotifications();
    setBusy(false);
    if (!result.ok) { setError(result.error ?? "Something went wrong"); return; }
    setStatus(await getPushStatus());
  }

  async function disable() {
    setBusy(true);
    await disablePushNotifications();
    setBusy(false);
    setStatus(await getPushStatus());
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Notifications</h1>
      <p className="mt-2 text-gray-500">Choose how OPDesk lets you know about tasks, meetings, and updates.</p>

      <div className="card mt-6 max-w-lg p-6">
        <div className="font-semibold">Browser Push Notifications</div>
        <p className="mt-1 text-sm text-gray-500">
          Get notified instantly for task assignments, reviews, meeting invites, and more — even when OPDesk isn't open in a tab.
        </p>

        {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mt-4">
          {status === "loading" ? (
            <div className="h-9 w-32 animate-pulse rounded-xl bg-gray-100" />
          ) : status === "unsupported" ? (
            <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">Not supported in this browser.</div>
          ) : status === "denied" ? (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Notifications are blocked for this site. Enable them in your browser's site settings, then reload this page.
            </div>
          ) : status === "subscribed" ? (
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">Enabled</span>
              <button onClick={disable} disabled={busy} className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50">
                Turn off
              </button>
            </div>
          ) : (
            <button onClick={enable} disabled={busy} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Enabling…" : "Enable push notifications"}
            </button>
          )}
        </div>
      </div>

      <div className="card mt-5 max-w-lg p-6">
        <div className="font-semibold">In-app Notifications</div>
        <p className="mt-1 text-sm text-gray-500">
          Always on — check the bell icon in the header, or visit the{" "}
          <a href="/notifications" className="font-medium text-gray-800 underline">Notifications</a> page.
        </p>
      </div>
    </div>
  );
}
