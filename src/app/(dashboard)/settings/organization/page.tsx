"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type GoogleStatus = { configured: boolean; connected: boolean };

const GOOGLE_MESSAGES: Record<string, { tone: "success" | "error"; text: string }> = {
  connected: { tone: "success", text: "Google Calendar connected. New meetings you organize will sync automatically." },
  denied: { tone: "error", text: "Google Calendar connection was cancelled." },
  state_mismatch: { tone: "error", text: "Connection failed — please try again." },
  no_refresh_token: { tone: "error", text: "Google didn't grant offline access. Try disconnecting any prior authorization in your Google account and reconnecting." },
  error: { tone: "error", text: "Something went wrong connecting Google Calendar." },
  unauthorized: { tone: "error", text: "Please sign in and try again." },
};

export default function OrganizationSettingsPage() {
  const searchParams = useSearchParams();
  const googleParam = searchParams.get("google");

  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/integrations/google/status");
    setGoogle(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function disconnectGoogle() {
    setBusy(true);
    await fetch("/api/integrations/google/disconnect", { method: "POST" });
    setBusy(false);
    load();
  }

  const banner = googleParam ? GOOGLE_MESSAGES[googleParam] : null;

  return (
    <div>
      <h1 className="text-2xl font-bold">Organization</h1>
      <p className="mt-2 text-gray-500">Organization profile and connected integrations.</p>

      {banner && (
        <div className={`mt-5 rounded-xl p-4 text-sm ${banner.tone === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {banner.text}
        </div>
      )}

      <div className="card mt-6 max-w-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Google Calendar</div>
            <p className="mt-1 text-sm text-gray-500">
              Sync meetings you organize to your Google Calendar automatically.
            </p>
          </div>
        </div>

        {!google ? (
          <div className="mt-4 h-9 w-32 animate-pulse rounded-xl bg-gray-100" />
        ) : !google.configured ? (
          <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-500">
            Not configured — set <code className="font-mono text-xs">GOOGLE_CLIENT_ID</code>,{" "}
            <code className="font-mono text-xs">GOOGLE_CLIENT_SECRET</code>, and{" "}
            <code className="font-mono text-xs">GOOGLE_REDIRECT_URI</code> to enable this.
          </div>
        ) : google.connected ? (
          <div className="mt-4 flex items-center justify-between">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">Connected</span>
            <button onClick={disconnectGoogle} disabled={busy} className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50">
              Disconnect
            </button>
          </div>
        ) : (
          <a href="/api/integrations/google/connect" className="mt-4 inline-block rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
            Connect Google Calendar
          </a>
        )}
      </div>
    </div>
  );
}
