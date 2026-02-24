"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Plus, Upload, RefreshCw, MoreHorizontal, Trash2, Zap, ChevronDown, Edit
} from "lucide-react";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type ProxyStatus = "live" | "die" | "timeout" | "auth_failed" | "unchecked";
interface Proxy {
    id?: string; _id?: string; ip: string; port: number;
    username?: string; password?: string;
    protocol: string; provider_name?: string;
    expire_at?: string; cost?: number;
    status: ProxyStatus; last_check?: string; latency?: number; note?: string;
}

// ── Status badge ─────────────────────────────────────────────────────────────

const statusConfig: Record<ProxyStatus, { label: string; className: string }> = {
    live: { label: "Live", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 animate-pulse" },
    die: { label: "Die", className: "bg-red-500/15 text-red-400 border-red-500/30" },
    timeout: { label: "Timeout", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    auth_failed: { label: "Auth Failed", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
    unchecked: { label: "Unchecked", className: "bg-slate-700 text-slate-400 border-slate-600" },
};

function StatusBadge({ status }: { status: ProxyStatus }) {
    const cfg = statusConfig[status] ?? statusConfig.unchecked;
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}>
            {status === "live" && <span className="mr-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            {cfg.label}
        </span>
    );
}

// ── API hooks ─────────────────────────────────────────────────────────────────

const fetchProxies = async () => {
    const { data } = await api.get("/api/proxies?limit=200");
    return data;
};

// ── Add Proxy Form ──────────────────────────────────────────────────────────

function AddProxyDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        ip: "", port: "", username: "", password: "",
        protocol: "http", provider_name: "", cost: "", note: "", expire_at: "",
    });

    const mutation = useMutation({
        mutationFn: (body: object) => api.post("/api/proxies", body),
        onSuccess: () => { toast.success("Proxy added!"); setOpen(false); onSuccess(); },
        onError: () => toast.error("Failed to add proxy"),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate({
            ip: form.ip, port: parseInt(form.port),
            username: form.username || undefined,
            password: form.password || undefined,
            protocol: form.protocol,
            provider_name: form.provider_name || undefined,
            cost: form.cost ? parseFloat(form.cost) : undefined,
            note: form.note || undefined,
            expire_at: form.expire_at || undefined,
        });
    };

    const f = (k: keyof typeof form) => ({ value: form[k], onChange: (e: any) => setForm(p => ({ ...p, [k]: e.target.value })) });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700">
                    <Plus className="w-4 h-4 mr-1" /> Add Proxy
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0d1426] border-white/10 text-slate-100 max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add New Proxy</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-slate-300 text-xs">IP Address *</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" placeholder="192.168.1.1" required {...f("ip")} /></div>
                        <div><Label className="text-slate-300 text-xs">Port *</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" type="number" placeholder="8080" required {...f("port")} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-slate-300 text-xs">Username</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" placeholder="user" {...f("username")} /></div>
                        <div><Label className="text-slate-300 text-xs">Password</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" placeholder="pass" {...f("password")} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-slate-300 text-xs">Protocol</Label>
                            <Select value={form.protocol} onValueChange={v => setForm(p => ({ ...p, protocol: v }))}>
                                <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-[#0d1426] border-white/10">
                                    <SelectItem value="http">HTTP</SelectItem>
                                    <SelectItem value="https">HTTPS</SelectItem>
                                    <SelectItem value="socks5">SOCKS5</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label className="text-slate-300 text-xs">Provider</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" placeholder="Tinsoft..." {...f("provider_name")} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-slate-300 text-xs">Cost (đ/month)</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" type="number" placeholder="50000" {...f("cost")} /></div>
                        <div><Label className="text-slate-300 text-xs">Expire Date</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" type="datetime-local" {...f("expire_at")} /></div>
                    </div>
                    <div><Label className="text-slate-300 text-xs">Note</Label>
                        <Input className="mt-1 bg-white/5 border-white/10" placeholder="Optional note..." {...f("note")} /></div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={mutation.isPending}>
                            {mutation.isPending ? "Adding..." : "Add Proxy"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditProxyDialog({ proxy, onClose, onSuccess }: { proxy: Proxy | null; onClose: () => void; onSuccess: () => void; }) {
    const [form, setForm] = useState({
        ip: proxy?.ip || "", port: proxy?.port?.toString() || "", username: proxy?.username || "", password: proxy?.password || "",
        protocol: proxy?.protocol || "http", provider_name: proxy?.provider_name || "", cost: proxy?.cost?.toString() || "", note: proxy?.note || "",
        // Need to convert to datetime-local format format "YYYY-MM-DDThh:mm"
        expire_at: proxy?.expire_at ? new Date(proxy.expire_at).toISOString().slice(0, 16) : "",
    });

    const mutation = useMutation({
        mutationFn: (body: object) => api.put(`/api/proxies/${proxy?._id || proxy?.id}`, body),
        onSuccess: () => { toast.success("Proxy updated!"); onSuccess(); },
        onError: () => toast.error("Failed to update proxy"),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate({
            ip: form.ip, port: parseInt(form.port) || 0,
            username: form.username || undefined,
            password: form.password || undefined,
            protocol: form.protocol,
            provider_name: form.provider_name || undefined,
            cost: form.cost ? parseFloat(form.cost) : undefined,
            note: form.note || undefined,
            expire_at: form.expire_at ? new Date(form.expire_at).toISOString() : undefined,
        });
    };

    const f = (k: keyof typeof form) => ({ value: form[k], onChange: (e: any) => setForm(p => ({ ...p, [k]: e.target.value })) });

    return (
        <Dialog open={!!proxy} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="bg-[#0d1426] border-white/10 text-slate-100 max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit Proxy</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-slate-300 text-xs">IP Address *</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" placeholder="192.168.1.1" required {...f("ip")} /></div>
                        <div><Label className="text-slate-300 text-xs">Port *</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" type="number" placeholder="8080" required {...f("port")} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-slate-300 text-xs">Username</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" placeholder="user" {...f("username")} /></div>
                        <div><Label className="text-slate-300 text-xs">Password</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" placeholder="pass" {...f("password")} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-slate-300 text-xs">Protocol</Label>
                            <Select value={form.protocol} onValueChange={v => setForm(p => ({ ...p, protocol: v }))}>
                                <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-[#0d1426] border-white/10">
                                    <SelectItem value="http">HTTP</SelectItem>
                                    <SelectItem value="https">HTTPS</SelectItem>
                                    <SelectItem value="socks5">SOCKS5</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label className="text-slate-300 text-xs">Provider</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" placeholder="Tinsoft..." {...f("provider_name")} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-slate-300 text-xs">Cost (đ/month)</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" type="number" placeholder="50000" {...f("cost")} /></div>
                        <div><Label className="text-slate-300 text-xs">Expire Date</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" type="datetime-local" {...f("expire_at")} /></div>
                    </div>
                    <div><Label className="text-slate-300 text-xs">Note</Label>
                        <Input className="mt-1 bg-white/5 border-white/10" placeholder="Optional note..." {...f("note")} /></div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={mutation.isPending}>
                            {mutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Import Dialog ─────────────────────────────────────────────────────────────

function ImportDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [protocol, setProtocol] = useState("http");
    const [provider, setProvider] = useState("");
    const [cost, setCost] = useState("");

    const mutation = useMutation({
        mutationFn: (body: object) => api.post("/api/proxies/import", body),
        onSuccess: (res) => {
            toast.success(`Imported ${res.data.imported} proxies (${res.data.failed} failed)`);
            setOpen(false);
            setText("");
            onSuccess();
        },
        onError: () => toast.error("Import failed"),
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10">
                    <Upload className="w-4 h-4 mr-1" /> Import
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0d1426] border-white/10 text-slate-100 max-w-lg">
                <DialogHeader>
                    <DialogTitle>Bulk Import Proxies</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                    <div className="text-xs text-slate-400 bg-white/5 rounded-lg p-3 font-mono space-y-1">
                        <p className="text-slate-300 font-sans font-medium mb-2">Supported formats:</p>
                        <p>ip:port</p>
                        <p>ip:port:user:pass</p>
                        <p>user:pass@ip:port</p>
                    </div>
                    <textarea
                        className="w-full h-40 bg-white/5 border border-white/10 rounded-lg p-3 text-sm font-mono text-slate-200 resize-none focus:outline-none focus:border-violet-500/50"
                        placeholder={"1.2.3.4:8080\n1.2.3.4:8080:user:pass\nuser:pass@1.2.3.5:8080"}
                        value={text}
                        onChange={e => setText(e.target.value)}
                    />
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label className="text-xs text-slate-300">Protocol</Label>
                            <Select value={protocol} onValueChange={setProtocol}>
                                <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-[#0d1426] border-white/10">
                                    <SelectItem value="http">HTTP</SelectItem>
                                    <SelectItem value="https">HTTPS</SelectItem>
                                    <SelectItem value="socks5">SOCKS5</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs text-slate-300">Provider</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" placeholder="Tinsoft" value={provider} onChange={e => setProvider(e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs text-slate-300">Cost (đ)</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" type="number" placeholder="50000" value={cost} onChange={e => setCost(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button className="bg-violet-600 hover:bg-violet-700" disabled={!text.trim() || mutation.isPending}
                            onClick={() => mutation.mutate({ text, protocol, provider_name: provider || undefined, cost: cost ? parseFloat(cost) : undefined })}>
                            {mutation.isPending ? "Importing..." : `Import ${text.trim().split("\n").filter(Boolean).length} proxies`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProxiesPage() {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ["proxies"], queryFn: fetchProxies, refetchInterval: 15000 });
    const [checkingAll, setCheckingAll] = useState(false);
    const [checkingId, setCheckingId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [editingProxy, setEditingProxy] = useState<Proxy | null>(null);

    const invalidate = () => qc.invalidateQueries({ queryKey: ["proxies"] });

    const checkAll = async () => {
        setCheckingAll(true);
        try {
            await api.post("/api/proxies/check-all/run");
            toast.success("Check started in background — refreshing in 5s...");
            setTimeout(() => { invalidate(); setCheckingAll(false); }, 5000);
        } catch { toast.error("Failed to start check"); setCheckingAll(false); }
    };

    const checkOne = async (id: string) => {
        setCheckingId(id);
        try {
            await api.post(`/api/proxies/${id}/check`);
            await invalidate();
            toast.success("Proxy checked!");
        } catch { toast.error("Check failed"); }
        setCheckingId(null);
    };

    const deleteProxy = useMutation({
        mutationFn: (id: string) => api.delete(`/api/proxies/${id}`),
        onSuccess: () => { toast.success("Proxy deleted"); invalidate(); },
        onError: () => toast.error("Delete failed"),
    });

    const proxies: Proxy[] = data?.data ?? [];
    const filtered = filterStatus === "all" ? proxies : proxies.filter(p => p.status === filterStatus);

    const stats = {
        total: proxies.length,
        live: proxies.filter(p => p.status === "live").length,
        die: proxies.filter(p => p.status === "die").length,
        unchecked: proxies.filter(p => p.status === "unchecked").length,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Proxies</h1>
                    <p className="text-slate-400 text-sm mt-0.5">{stats.total} total · {stats.live} live · {stats.die} dead</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10"
                        onClick={checkAll} disabled={checkingAll}>
                        <Zap className={`w-4 h-4 mr-1 ${checkingAll ? "animate-pulse text-amber-400" : ""}`} />
                        {checkingAll ? "Checking..." : "Check All"}
                    </Button>
                    <ImportDialog onSuccess={invalidate} />
                    <AddProxyDialog onSuccess={invalidate} />
                </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-lg w-fit">
                {["all", "live", "die", "timeout", "unchecked"].map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${filterStatus === s ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}>
                        {s === "all" ? `All (${stats.total})` : s === "live" ? `Live (${stats.live})` : s === "die" ? `Die (${stats.die})` : s === "unchecked" ? `Unchecked (${stats.unchecked})` : s}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/5 bg-[#0d1426] overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                        <p className="text-sm">No proxies found. Add one or import!</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400 text-xs">Proxy</TableHead>
                                <TableHead className="text-slate-400 text-xs">Protocol</TableHead>
                                <TableHead className="text-slate-400 text-xs">Provider</TableHead>
                                <TableHead className="text-slate-400 text-xs">Status</TableHead>
                                <TableHead className="text-slate-400 text-xs">Latency</TableHead>
                                <TableHead className="text-slate-400 text-xs">Cost</TableHead>
                                <TableHead className="text-slate-400 text-xs">Expires</TableHead>
                                <TableHead className="text-slate-400 text-xs">Last Check</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((proxy) => {
                                const pId = proxy._id || proxy.id as string;
                                return (
                                    <TableRow key={pId} className="border-white/5 hover:bg-white/3 transition-colors">
                                        <TableCell className="font-mono text-xs text-slate-200">
                                            {proxy.ip}:{proxy.port}
                                            {proxy.username && <span className="text-slate-500 ml-1">({proxy.username})</span>}
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs uppercase bg-white/5 px-2 py-0.5 rounded text-slate-300">{proxy.protocol}</span>
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-400">{proxy.provider_name ?? "—"}</TableCell>
                                        <TableCell><StatusBadge status={proxy.status} /></TableCell>
                                        <TableCell className="text-xs text-slate-400">
                                            {proxy.latency != null ? <span className={proxy.latency < 500 ? "text-emerald-400" : "text-amber-400"}>{proxy.latency}ms</span> : "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-400">
                                            {proxy.cost ? `${proxy.cost.toLocaleString()} đ` : "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-400">
                                            {proxy.expire_at ? (
                                                <span className={new Date(proxy.expire_at) < new Date(Date.now() + 3 * 86400000) ? "text-amber-400" : ""}>
                                                    {new Date(proxy.expire_at).toLocaleDateString()}
                                                </span>
                                            ) : "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-400">
                                            {proxy.last_check ? new Date(proxy.last_check).toLocaleString() : "Never"}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="bg-[#0d1426] border-white/10" align="end">
                                                    <DropdownMenuItem className="text-slate-300 hover:text-white cursor-pointer"
                                                        onClick={() => setEditingProxy(proxy)}>
                                                        <Edit className="w-3 h-3 mr-2" /> Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-slate-300 hover:text-white cursor-pointer"
                                                        onClick={() => checkOne(pId)} disabled={checkingId === pId}>
                                                        <RefreshCw className={`w-3 h-3 mr-2 ${checkingId === pId ? "animate-spin" : ""}`} />
                                                        {checkingId === pId ? "Checking..." : "Check Now"}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-400 hover:text-red-300 cursor-pointer"
                                                        onClick={() => deleteProxy.mutate(pId)}>
                                                        <Trash2 className="w-3 h-3 mr-2" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>

            {editingProxy && (
                <EditProxyDialog key={editingProxy._id || editingProxy.id} proxy={editingProxy}
                    onClose={() => setEditingProxy(null)}
                    onSuccess={() => { invalidate(); setEditingProxy(null); }} />
            )}
        </div>
    );
}
