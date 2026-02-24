"use client";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Globe, Users, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";

async function fetchDashboard() {
  const { data } = await api.get("/api/dashboard");
  return data;
}

function StatCard({
  title, value, sub, icon: Icon, color,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className={`rounded-xl p-5 card-gradient backdrop-blur-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white/5`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 30000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-96 gap-3 text-slate-400">
      <XCircle className="w-12 h-12 text-red-400" />
      <p>Cannot connect to backend. Is FastAPI running on port 8000?</p>
    </div>
  );

  const ps = data?.proxies ?? {};
  const acc = data?.accounts ?? {};
  const billing = data?.billing ?? {};
  const byStatus = ps.by_status ?? {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Real-time overview of your proxies &amp; accounts</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Proxies" value={ps.total ?? 0} icon={Globe} color="text-violet-400" />
        <StatCard title="Live" value={byStatus.live ?? 0}
          sub={`${ps.total ? Math.round(((byStatus.live ?? 0) / ps.total) * 100) : 0}% healthy`}
          icon={CheckCircle2} color="text-emerald-400" />
        <StatCard title="Dead / Timeout" value={(byStatus.die ?? 0) + (byStatus.timeout ?? 0)}
          icon={XCircle} color="text-red-400" />
        <StatCard title="Accounts" value={acc.total ?? 0} icon={Users} color="text-sky-400" />
      </div>

      {/* Billing Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl p-5 card-gradient col-span-1">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-4">Billing Overview</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-300">Monthly Cost (Active)</span>
              <span className="font-bold text-white">{billing.total_monthly_cost?.toLocaleString() ?? 0} đ</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-300">Renewal Needed</span>
              <span className="font-bold text-amber-400">{billing.renewal_needed?.toLocaleString() ?? 0} đ</span>
            </div>
          </div>
          {Object.entries(billing.by_provider ?? {}).length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
              <p className="text-xs text-slate-500 mb-2">By Provider</p>
              {Object.entries(billing.by_provider ?? {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-slate-400">{k}</span>
                  <span className="text-slate-200">{(v as number).toLocaleString()} đ</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Proxy Status Breakdown */}
        <div className="rounded-xl p-5 card-gradient col-span-1">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-4">Proxy Status Breakdown</p>
          <div className="space-y-3">
            {[
              { label: "Live", key: "live", color: "bg-emerald-400", textColor: "text-emerald-400" },
              { label: "Die", key: "die", color: "bg-red-400", textColor: "text-red-400" },
              { label: "Timeout", key: "timeout", color: "bg-amber-400", textColor: "text-amber-400" },
              { label: "Auth Failed", key: "auth_failed", color: "bg-orange-400", textColor: "text-orange-400" },
              { label: "Unchecked", key: "unchecked", color: "bg-slate-500", textColor: "text-slate-400" },
            ].map(({ label, key, color, textColor }) => {
              const count = byStatus[key] ?? 0;
              const pct = ps.total ? (count / ps.total) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={textColor}>{label}</span>
                    <span className="text-slate-400">{count}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="rounded-xl p-5 card-gradient col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-amber-400 uppercase tracking-wider font-medium">Expiring in 3 Days</p>
          </div>
          {(ps.expiring_soon?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-slate-500 text-sm">
              <CheckCircle2 className="w-6 h-6 mb-2 text-emerald-600" />
              All good — no proxies expiring soon
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {ps.expiring_soon.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm bg-white/3 rounded-lg px-3 py-2">
                  <span className="font-mono text-slate-300">{p.ip}:{p.port}</span>
                  <span className="text-amber-400 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {p.expire_at ? new Date(p.expire_at).toLocaleDateString() : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Advantages over Google Sheets */}
      {/* <div className="rounded-xl p-6 border border-violet-500/20 bg-violet-500/5">
        <p className="text-sm font-semibold text-violet-300 mb-3">✨ Why this beats Google Sheets</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            "🟢 Real-time Live/Die status checking",
            "⚡ One-click bulk proxy check",
            "📥 Paste-to-import proxy lists",
            "🔔 Expiry alerts before it's too late",
          ].map((item) => (
            <div key={item} className="text-xs text-slate-300 bg-white/5 rounded-lg px-3 py-2">{item}</div>
          ))}
        </div>
      </div> */}
    </div>
  );
}
