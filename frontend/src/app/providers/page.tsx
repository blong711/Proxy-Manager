"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Provider { id: string; name: string; api_url?: string; api_key?: string; created_at: string; }

const fetchProviders = async () => { const { data } = await api.get("/api/providers"); return data; };

function AddProviderDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", api_url: "", api_key: "" });
    const f = (k: keyof typeof form) => ({ value: form[k], onChange: (e: any) => setForm(p => ({ ...p, [k]: e.target.value })) });

    const mutation = useMutation({
        mutationFn: (body: object) => api.post("/api/providers", body),
        onSuccess: () => { toast.success("Provider added!"); setOpen(false); onSuccess(); },
        onError: () => toast.error("Failed"),
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-1" />Add Provider</Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0d1426] border-white/10 text-slate-100">
                <DialogHeader><DialogTitle>Add Provider</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); mutation.mutate({ name: form.name, api_url: form.api_url || undefined, api_key: form.api_key || undefined }); }} className="space-y-4 mt-2">
                    <div><Label className="text-xs text-slate-300">Name *</Label>
                        <Input className="mt-1 bg-white/5 border-white/10" placeholder="Tinsoft" required {...f("name")} /></div>
                    <div><Label className="text-xs text-slate-300">API URL</Label>
                        <Input className="mt-1 bg-white/5 border-white/10" placeholder="https://api.provider.com" {...f("api_url")} /></div>
                    <div><Label className="text-xs text-slate-300">API Key</Label>
                        <Input className="mt-1 bg-white/5 border-white/10" placeholder="sk-..." type="password" {...f("api_key")} /></div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={mutation.isPending}>
                            {mutation.isPending ? "Adding..." : "Add"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function ProvidersPage() {
    const qc = useQueryClient();
    const { data: providers = [], isLoading } = useQuery({ queryKey: ["providers"], queryFn: fetchProviders });
    const invalidate = () => qc.invalidateQueries({ queryKey: ["providers"] });

    const deleteProv = useMutation({
        mutationFn: (id: string) => api.delete(`/api/providers/${id}`),
        onSuccess: () => { toast.success("Provider deleted"); invalidate(); },
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Providers</h1>
                    <p className="text-slate-400 text-sm mt-0.5">Manage proxy provider credentials</p>
                </div>
                <AddProviderDialog onSuccess={invalidate} />
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : providers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
                    <Building2 className="w-10 h-10 text-slate-700" />
                    <p className="text-sm">No providers yet. Add Tinsoft, TMProxy, etc.</p>
                </div>
            ) : (
                <div className="rounded-xl border border-white/5 bg-[#0d1426] overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-400 text-xs">Name</TableHead>
                                <TableHead className="text-slate-400 text-xs">API URL</TableHead>
                                <TableHead className="text-slate-400 text-xs">API Key</TableHead>
                                <TableHead className="text-slate-400 text-xs">Added</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {providers.map((p: Provider) => (
                                <TableRow key={p.id} className="border-white/5 hover:bg-white/3">
                                    <TableCell className="font-medium text-slate-200">{p.name}</TableCell>
                                    <TableCell className="text-xs text-slate-400 font-mono">{p.api_url ?? "—"}</TableCell>
                                    <TableCell className="text-xs text-slate-500">{p.api_key ? "••••••••" : "—"}</TableCell>
                                    <TableCell className="text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="bg-[#0d1426] border-white/10" align="end">
                                                <DropdownMenuItem className="text-red-400 hover:text-red-300 cursor-pointer" onClick={() => deleteProv.mutate(p.id)}>
                                                    <Trash2 className="w-3 h-3 mr-2" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
