"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
    UserCircle, Shield, ShieldOff, Trash2, RefreshCw,
    Users, Crown, UserCheck, UserX, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

interface UserItem {
    id: string;
    username: string;
    role: "user" | "admin";
    is_active: boolean;
}

async function fetchUsers(): Promise<UserItem[]> {
    const { data } = await api.get("/api/auth/users");
    return data;
}

export default function UsersPage() {
    const { user: me } = useAuth();
    const router = useRouter();
    const qc = useQueryClient();
    const [loadingStates, setLoadingStates] = useState<Record<string, string>>({});

    if (me?.role !== "admin") {
        router.replace("/");
        return null;
    }

    const { data: users = [], isLoading, isError } = useQuery({
        queryKey: ["users"],
        queryFn: fetchUsers,
    });

    const setLoading = (username: string, action: string) =>
        setLoadingStates((s) => ({ ...s, [username]: action }));
    const clearLoading = (username: string) =>
        setLoadingStates((s) => { const n = { ...s }; delete n[username]; return n; });

    const changeRole = useMutation({
        mutationFn: ({ username, role }: { username: string; role: string }) =>
            api.patch(`/api/auth/users/${username}/role`, { role }),
        onMutate: ({ username }) => setLoading(username, "role"),
        onSuccess: (_, { username, role }) => {
            qc.invalidateQueries({ queryKey: ["users"] });
            toast.success(`Đổi role "${username}" thành ${role === "admin" ? "Admin" : "User"}`);
        },
        onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Lỗi đổi role"),
        onSettled: (_, __, { username }) => clearLoading(username),
    });

    const toggleActive = useMutation({
        mutationFn: (username: string) => api.patch(`/api/auth/users/${username}/toggle`),
        onMutate: (username) => setLoading(username, "toggle"),
        onSuccess: (res, username) => {
            qc.invalidateQueries({ queryKey: ["users"] });
            toast.success(`${res.data.is_active ? "Mở khóa" : "Khóa"} tài khoản "${username}"`);
        },
        onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Lỗi cập nhật"),
        onSettled: (_, __, username) => clearLoading(username),
    });

    const deleteUser = useMutation({
        mutationFn: (username: string) => api.delete(`/api/auth/users/${username}`),
        onMutate: (username) => setLoading(username, "delete"),
        onSuccess: (_, username) => {
            qc.invalidateQueries({ queryKey: ["users"] });
            toast.success(`Đã xóa tài khoản "${username}"`);
        },
        onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Lỗi xóa user"),
        onSettled: (_, __, username) => clearLoading(username),
    });

    const admins = users.filter((u) => u.role === "admin");
    const regularUsers = users.filter((u) => u.role === "user");

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Quản lý người dùng</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {users.length} tài khoản · {admins.length} admin · {regularUsers.length} user
                    </p>
                </div>
                <button onClick={() => qc.invalidateQueries({ queryKey: ["users"] })}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-sm transition-all">
                    <RefreshCw className="w-4 h-4" /> Làm mới
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: "Tổng tài khoản", value: users.length, icon: Users, color: "text-violet-400" },
                    { label: "Đang hoạt động", value: users.filter(u => u.is_active).length, icon: UserCheck, color: "text-emerald-400" },
                    { label: "Đã khóa", value: users.filter(u => !u.is_active).length, icon: UserX, color: "text-red-400" },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="rounded-xl p-4 bg-white/3 border border-white/5">
                        <div className="flex items-center gap-3">
                            <Icon className={`w-5 h-5 ${color}`} />
                            <div>
                                <p className="text-xs text-slate-500">{label}</p>
                                <p className={`text-xl font-bold ${color}`}>{value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/5 bg-white/3 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Đang tải...
                    </div>
                ) : isError ? (
                    <div className="flex items-center justify-center h-40 text-red-400 text-sm">
                        Không thể tải danh sách người dùng
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left px-5 py-3.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Tài khoản</th>
                                <th className="text-left px-5 py-3.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                                <th className="text-left px-5 py-3.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái</th>
                                <th className="px-5 py-3.5 text-xs font-medium text-slate-500 uppercase tracking-wider text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {users.map((u) => {
                                const isMe = u.username === me?.username;
                                const busy = loadingStates[u.username];
                                return (
                                    <tr key={u.id} className={`transition-colors ${!u.is_active ? "opacity-50" : "hover:bg-white/2"}`}>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                                                    ${u.role === "admin" ? "bg-violet-500/20 text-violet-300" : "bg-sky-500/20 text-sky-300"}`}>
                                                    {u.username[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{u.username}</p>
                                                    {isMe && <span className="text-[10px] text-slate-500">(bạn)</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            {isMe ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-violet-500/20 text-violet-300">
                                                    <Crown className="w-3 h-3" /> Admin
                                                </span>
                                            ) : (
                                                <RoleDropdown
                                                    username={u.username}
                                                    role={u.role}
                                                    busy={busy === "role"}
                                                    onChange={(role) => changeRole.mutate({ username: u.username, role })}
                                                />
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold
                                                ${u.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                                                {u.is_active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                                                {u.is_active ? "Hoạt động" : "Đã khóa"}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2 justify-end">
                                                {!isMe && (
                                                    <>
                                                        <button
                                                            onClick={() => toggleActive.mutate(u.username)}
                                                            disabled={!!busy}
                                                            title={u.is_active ? "Khóa tài khoản" : "Mở khóa"}
                                                            className={`p-2 rounded-lg transition-all disabled:opacity-50
                                                                ${u.is_active
                                                                    ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400"
                                                                    : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"}`}>
                                                            {busy === "toggle" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> :
                                                                u.is_active ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`Xóa tài khoản "${u.username}"?`))
                                                                    deleteUser.mutate(u.username);
                                                            }}
                                                            disabled={!!busy}
                                                            title="Xóa tài khoản"
                                                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all disabled:opacity-50">
                                                            {busy === "delete" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function RoleDropdown({ username, role, busy, onChange }: {
    username: string; role: string; busy: boolean;
    onChange: (role: string) => void;
}) {
    const isAdmin = role === "admin";
    return (
        <div className="relative inline-block">
            <select
                value={role}
                disabled={busy}
                onChange={(e) => onChange(e.target.value)}
                className={`appearance-none pl-2 pr-7 py-1 rounded-md text-xs font-semibold cursor-pointer border transition-all disabled:opacity-50 disabled:cursor-not-allowed
                    ${isAdmin
                        ? "bg-violet-500/20 border-violet-500/30 text-violet-300"
                        : "bg-sky-500/20 border-sky-500/30 text-sky-300"
                    } focus:outline-none`}
            >
                <option value="user" className="bg-[#0d1426] text-slate-200">User</option>
                <option value="admin" className="bg-[#0d1426] text-slate-200">Admin</option>
            </select>
            <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
        </div>
    );
}
