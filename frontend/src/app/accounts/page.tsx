"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

type AccountStatus = "active" | "inactive" | "banned";
interface Account {
    id: string; _id?: string; username: string; password: string; platform: string;
    note?: string; status: AccountStatus; proxy_id?: string; created_at: string;
}

interface Proxy {
    _id: string; ip: string; port: number; status: string;
}

const statusCfg: Record<AccountStatus, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    inactive: "bg-slate-700 text-slate-400 border-slate-600",
    banned: "bg-red-500/15 text-red-400 border-red-500/30",
};

const fetchAccounts = async () => {
    const { data } = await api.get("/api/accounts?limit=200");
    return data;
};

const fetchProxies = async () => {
    const { data } = await api.get("/api/proxies?limit=200");
    return data.data || [];
};

function AddAccountDialog({ onSuccess, proxies }: { onSuccess: () => void, proxies: Proxy[] }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ username: "", password: "", platform: "TikTok", note: "", status: "active", proxy_id: "none" });
    const f = (k: keyof typeof form) => ({ value: form[k], onChange: (e: any) => setForm(p => ({ ...p, [k]: e.target.value })) });

    const mutation = useMutation({
        mutationFn: (body: object) => api.post("/api/accounts", body),
        onSuccess: () => { toast.success("Account added!"); setOpen(false); onSuccess(); },
        onError: () => toast.error("Failed to add account"),
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700">
                    <Plus className="w-4 h-4 mr-1" /> Add Account
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0d1426] border-white/10 text-slate-100">
                <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
                <form onSubmit={e => {
                    e.preventDefault();
                    const payload = { ...form, proxy_id: form.proxy_id === "none" ? undefined : form.proxy_id };
                    mutation.mutate(payload);
                }} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs text-slate-300">Username *</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" required {...f("username")} /></div>
                        <div><Label className="text-xs text-slate-300">Password *</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" required {...f("password")} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs text-slate-300">Platform</Label>
                            <Select value={form.platform} onValueChange={v => setForm(p => ({ ...p, platform: v }))}>
                                <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-[#0d1426] border-white/10">
                                    {["Facebook", "Instagram", "TikTok", "Twitter", "Other"].map(pl => (
                                        <SelectItem key={pl} value={pl}>{pl}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label className="text-xs text-slate-300">Status</Label>
                            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as AccountStatus }))}>
                                <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-[#0d1426] border-white/10">
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="banned">Banned</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div><Label className="text-xs text-slate-300">Proxy Binding</Label>
                        <Select value={form.proxy_id} onValueChange={v => setForm(p => ({ ...p, proxy_id: v }))}>
                            <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#0d1426] border-white/10 max-h-48">
                                <SelectItem value="none" className="text-slate-400 font-italic">No Proxy (Direct)</SelectItem>
                                {proxies.map(px => (
                                    <SelectItem key={px._id} value={px._id}>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${px.status === 'live' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                            <span className="font-mono text-xs">{px.ip}:{px.port}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label className="text-xs text-slate-300">Note</Label>
                        <Input className="mt-1 bg-white/5 border-white/10" placeholder="Optional..." {...f("note")} /></div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={mutation.isPending}>
                            {mutation.isPending ? "Adding..." : "Add Account"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditAccountDialog({ account, onClose, onSuccess, proxies }: { account: Account | null; onClose: () => void; onSuccess: () => void; proxies: Proxy[]; }) {
    const [form, setForm] = useState({
        username: account?.username || "",
        password: account?.password || "",
        platform: account?.platform || "TikTok",
        note: account?.note || "",
        status: account?.status || "active",
        proxy_id: account?.proxy_id || "none"
    });
    const f = (k: keyof typeof form) => ({ value: form[k], onChange: (e: any) => setForm(p => ({ ...p, [k]: e.target.value })) });

    const mutation = useMutation({
        mutationFn: (body: object) => api.put(`/api/accounts/${account?._id || account?.id}`, body),
        onSuccess: () => { toast.success("Account updated!"); onSuccess(); },
        onError: () => toast.error("Failed to update account"),
    });

    return (
        <Dialog open={!!account} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="bg-[#0d1426] border-white/10 text-slate-100">
                <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
                <form onSubmit={e => {
                    e.preventDefault();
                    const payload = { ...form, proxy_id: form.proxy_id === "none" ? undefined : form.proxy_id };
                    mutation.mutate(payload);
                }} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs text-slate-300">Username *</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" required {...f("username")} /></div>
                        <div><Label className="text-xs text-slate-300">Password *</Label>
                            <Input className="mt-1 bg-white/5 border-white/10" required {...f("password")} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs text-slate-300">Platform</Label>
                            <Select value={form.platform} onValueChange={v => setForm(p => ({ ...p, platform: v }))}>
                                <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-[#0d1426] border-white/10">
                                    {["TikTok", "Amazon", "eBay", "Etsy", "Other"].map(pl => (
                                        <SelectItem key={pl} value={pl}>{pl}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label className="text-xs text-slate-300">Status</Label>
                            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as AccountStatus }))}>
                                <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-[#0d1426] border-white/10">
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="banned">Banned</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div><Label className="text-xs text-slate-300">Proxy Binding</Label>
                        <Select value={form.proxy_id} onValueChange={v => setForm(p => ({ ...p, proxy_id: v }))}>
                            <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#0d1426] border-white/10 max-h-48">
                                <SelectItem value="none" className="text-slate-400 font-italic">No Proxy (Direct)</SelectItem>
                                {proxies.map(px => (
                                    <SelectItem key={px._id} value={px._id}>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${px.status === 'live' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                            <span className="font-mono text-xs">{px.ip}:{px.port}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label className="text-xs text-slate-300">Note</Label>
                        <Input className="mt-1 bg-white/5 border-white/10" placeholder="Optional..." {...f("note")} /></div>
                    <div className="flex justify-end gap-2">
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

export default function AccountsPage() {
    const qc = useQueryClient();
    const { data: accountsData, isLoading: loadingAcc } = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
    const { data: proxiesData, isLoading: loadingPx } = useQuery({ queryKey: ["proxies_dropdown"], queryFn: fetchProxies });
    const isLoading = loadingAcc || loadingPx;
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);

    const invalidate = () => qc.invalidateQueries({ queryKey: ["accounts"] });

    const deleteAcc = useMutation({
        mutationFn: (id: string) => api.delete(`/api/accounts/${id}`),
        onSuccess: () => { toast.success("Account deleted"); invalidate(); },
        onError: () => toast.error("Delete failed"),
    });

    const accounts: Account[] = accountsData?.data ?? [];
    const proxiesList: Proxy[] = proxiesData ?? [];

    const getProxyName = (id?: string) => {
        if (!id) return "—";
        const px = proxiesList.find(p => p._id === id);
        return px ? `${px.ip}:${px.port}` : "Unknown Proxy";
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Accounts</h1>
                    <p className="text-slate-400 text-sm mt-0.5">{accounts.length} total accounts</p>
                </div>
                <AddAccountDialog onSuccess={invalidate} proxies={proxiesList} />
            </div>

            <div className="rounded-xl border border-white/5 bg-[#0d1426] overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm">
                        No accounts yet. Add your first one!
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400 text-xs">Username</TableHead>
                                <TableHead className="text-slate-400 text-xs">Platform</TableHead>
                                <TableHead className="text-slate-400 text-xs">Status</TableHead>
                                <TableHead className="text-slate-400 text-xs">Proxy</TableHead>
                                <TableHead className="text-slate-400 text-xs">Note</TableHead>
                                <TableHead className="text-slate-400 text-xs">Created</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {accounts.map((acc) => (
                                <TableRow key={acc.id} className="border-white/5 hover:bg-white/3 transition-colors">
                                    <TableCell className="font-medium text-slate-200">{acc.username}</TableCell>
                                    <TableCell>
                                        <span className="text-xs bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                                            {acc.platform}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-xs border px-2 py-0.5 rounded-full font-semibold capitalize ${statusCfg[acc.status]}`}>
                                            {acc.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-400 font-mono">
                                        {getProxyName(acc.proxy_id)}
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-400">{acc.note ?? "—"}</TableCell>
                                    <TableCell className="text-xs text-slate-400">
                                        {new Date(acc.created_at).toLocaleDateString()}
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
                                                    onClick={() => setEditingAccount(acc)}>
                                                    <Edit className="w-3 h-3 mr-2" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-400 hover:text-red-300 cursor-pointer"
                                                    onClick={() => deleteAcc.mutate(acc.id)}>
                                                    <Trash2 className="w-3 h-3 mr-2" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {editingAccount && (
                <EditAccountDialog key={editingAccount._id || editingAccount.id} account={editingAccount}
                    onClose={() => setEditingAccount(null)}
                    onSuccess={() => { invalidate(); setEditingAccount(null); }}
                    proxies={proxiesList} />
            )}
        </div>
    );
}
