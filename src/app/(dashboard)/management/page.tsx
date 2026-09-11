"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Review = { scope: string; people: { id:string; name:string; role:string }[]; compliance: { missingDailyUpdates:{id:string;name:string}[]; openTasks:number; overdueTasks:number; pendingLeave:number; openWarnings:number; pendingWarningApprovals:number; averageQuality:number } };
type Person = Review["people"][number];

export default function ManagementPage() {
  const [data,setData]=useState<Review|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  useEffect(()=>{fetch("/api/management/review-center",{cache:"no-store"}).then(async r=>{const j=await r.json(); if(!r.ok) throw new Error(j.error||"Unable to load"); return j}).then(setData).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[]);
  if(loading) return <div className="space-y-4"><div className="h-8 w-64 animate-pulse rounded bg-gray-100"/><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({length:8}).map((_,i)=><div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100"/>)}</div></div>;
  if(error) return <div className="card p-6"><h1 className="text-xl font-bold">Management Control Center</h1><p className="mt-2 text-sm text-red-600">{error}</p></div>;
  if(!data) return null;
  const c=data.compliance;
  const cards=[['Open tasks',c.openTasks,'/tasks'],['Overdue tasks',c.overdueTasks,'/tasks'],['Missing updates',c.missingDailyUpdates.length,'/daily-updates'],['Pending leave',c.pendingLeave,'/leave'],['Open warnings',c.openWarnings,'/warnings'],['Warning approvals',c.pendingWarningApprovals,'/warnings'],['Average quality',c.averageQuality ? `${c.averageQuality}/100` : '—','/quality'],['People in scope',data.people.length,'/people']];
  return <div className="space-y-6">
    <header><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold sm:text-3xl">Management Control Center</h1><p className="mt-1 text-sm text-gray-500">One operational view of the people you are responsible for.</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-500">{data.scope} scope</span></div></header>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{cards.map(([label,value,href])=><Link href={href as string} key={label as string} className="card p-4 transition hover:-translate-y-0.5 hover:shadow-md"><div className="text-2xl font-bold">{value}</div><div className="mt-1 text-xs text-gray-500">{label}</div></Link>)}</div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold">People requiring attention</h2><p className="text-xs text-gray-500">No daily update submitted today.</p></div><Link className="text-sm font-semibold" href="/daily-updates">Open updates</Link></div><div className="mt-4 divide-y">{c.missingDailyUpdates.length ? c.missingDailyUpdates.map(p=><Link href={`/management/${p.id}`} key={p.id} className="flex items-center justify-between py-3"><span className="font-medium">{p.name}</span><span className="text-xs font-semibold text-amber-700">Update missing</span></Link>) : <p className="py-4 text-sm text-gray-500">Everyone in scope has submitted today.</p>}</div></section>
      <section className="card p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold">People in your scope</h2><p className="text-xs text-gray-500">Open an employee record for the complete operational picture.</p></div><Link className="text-sm font-semibold" href="/people">People</Link></div><div className="mt-4 divide-y">{data.people.map((p:Person)=><Link href={`/management/${p.id}`} key={p.id} className="flex items-center justify-between py-3"><div><div className="font-medium">{p.name}</div><div className="text-xs text-gray-500">{p.role.replace(/_/g,' ')}</div></div><span className="text-xs text-gray-400">View →</span></Link>)}</div></section>
    </div>
  </div>;
}
