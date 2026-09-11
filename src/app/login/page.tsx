"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login(){
  const [identifier,setIdentifier]=useState("admin@opdesk.local"),[password,setPassword]=useState("OPDesk@123"),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const router=useRouter();
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier,password})});const d=await r.json();if(!r.ok){setError(d.error||"Login failed");setBusy(false);return}router.push("/dashboard");}
  return <main className="min-h-screen grid lg:grid-cols-2">
    <section className="hidden lg:flex bg-[#111827] text-white p-14 flex-col justify-between">
      <div><div className="text-3xl font-black tracking-tight">OPDesk</div><div className="text-sm text-white/60 mt-1">Workforce Operations</div></div>
      <div><div className="text-6xl font-semibold tracking-tight max-w-xl">One desk for the work that moves your company.</div><p className="mt-6 text-white/60 max-w-lg">Tasks, teams, meetings, attendance, updates, reminders and operational accountability in one workspace.</p></div>
      <div className="text-sm text-white/40">Bharat Infotechs</div>
    </section>
    <section className="flex items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-md p-8">
        <div className="mb-8"><div className="text-2xl font-black">OPDesk</div><div className="text-sm text-gray-500">Sign in to Workforce Operations</div></div>
        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="text-sm font-medium">Email or Employee ID<input value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="you@bharatinfotechs.com or BI-EMP-26-00001" className="mt-2 w-full rounded-xl border p-3" type="text"/></label>
        <label className="text-sm font-medium block mt-5">Password<input value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border p-3" type="password"/></label>
        <button disabled={busy} className="mt-6 w-full rounded-xl bg-gray-900 py-3 font-semibold text-white disabled:opacity-50">{busy?"Signing in...":"Sign in"}</button>
        <p className="mt-5 text-xs text-gray-400">Demo mode: admin@opdesk.local / OPDesk@123</p>
      </form>
    </section>
  </main>
}
