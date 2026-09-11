export default function Page(){
 return <div><div className="mb-8"><h1 className="text-3xl font-bold">Warnings</h1><p className="text-gray-500 mt-1">Track reminders, warnings and escalations.</p></div>
 <div className="card p-8"><div className="text-lg font-semibold">Warnings workspace</div><p className="text-gray-500 mt-2">The data model and service layer are connected. Use this workspace as the management surface for warnings.</p>
 <div className="mt-6 grid sm:grid-cols-3 gap-4"><div className="rounded-xl border p-4"><div className="text-2xl font-bold">—</div><div className="text-sm text-gray-500">Active</div></div><div className="rounded-xl border p-4"><div className="text-2xl font-bold">—</div><div className="text-sm text-gray-500">Pending</div></div><div className="rounded-xl border p-4"><div className="text-2xl font-bold">—</div><div className="text-sm text-gray-500">Attention</div></div></div></div></div>
}
