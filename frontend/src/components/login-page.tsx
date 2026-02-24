"use client";
import { useState, FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Shield, Eye, EyeOff, Loader2, ArrowLeft, UserPlus } from "lucide-react";
import api from "@/lib/api";

export default function LoginPage() {
    const { login } = useAuth();

    // --- Login state ---
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // --- Register state ---
    const [showRegister, setShowRegister] = useState(false);
    const [regUsername, setRegUsername] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [regConfirm, setRegConfirm] = useState("");
    const [showRegPass, setShowRegPass] = useState(false);
    const [regError, setRegError] = useState("");
    const [regSuccess, setRegSuccess] = useState("");
    const [regLoading, setRegLoading] = useState(false);

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            await login(username, password);
        } catch {
            setError("Sai tên đăng nhập hoặc mật khẩu.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: FormEvent) => {
        e.preventDefault();
        setRegError("");
        setRegSuccess("");
        if (regPassword !== regConfirm) {
            setRegError("Mật khẩu xác nhận không khớp.");
            return;
        }
        if (regPassword.length < 6) {
            setRegError("Mật khẩu phải có ít nhất 6 ký tự.");
            return;
        }
        setRegLoading(true);
        try {
            await api.post("/api/auth/register", { username: regUsername, password: regPassword });
            setRegSuccess(`Tạo tài khoản "${regUsername}" thành công! Hãy đăng nhập.`);
            setRegUsername("");
            setRegPassword("");
            setRegConfirm("");
        } catch (err: any) {
            setRegError(err?.response?.data?.detail ?? "Đã xảy ra lỗi.");
        } finally {
            setRegLoading(false);
        }
    };

    const switchToLogin = () => {
        setShowRegister(false);
        setRegError("");
        setRegSuccess("");
        setRegUsername("");
        setRegPassword("");
        setRegConfirm("");
    };

    return (
        <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-1/4 -left-32 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md">
                <div className="flex flex-col items-center mb-8 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/30">
                        <Shield className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-white tracking-tight">ProxyManager</h1>
                        <p className="text-slate-500 text-sm mt-0.5">
                            {showRegister ? "Tạo tài khoản mới" : "Đăng nhập để tiếp tục"}
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-white/4 backdrop-blur-xl p-8 shadow-2xl">
                    {!showRegister ? (
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Tên đăng nhập</label>
                                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Nhập username..." required autoFocus autoComplete="username"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-all duration-200" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Mật khẩu</label>
                                <div className="relative">
                                    <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Nhập mật khẩu..." required autoComplete="current-password"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-all duration-200" />
                                    <button type="button" onClick={() => setShowPass((p) => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            {error && <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>}
                            <button type="submit" disabled={isLoading}
                                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm shadow-lg shadow-violet-500/25 transition-all duration-200 flex items-center justify-center gap-2">
                                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Đang đăng nhập...</> : "Đăng nhập"}
                            </button>
                            <div className="pt-4 border-t border-white/5 text-center">
                                <span className="text-xs text-slate-500">Chưa có tài khoản? </span>
                                <button type="button" onClick={() => { setShowRegister(true); setError(""); }}
                                    className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors">Đăng ký</button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleRegister} className="space-y-4">
                            <button type="button" onClick={switchToLogin}
                                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2">
                                <ArrowLeft className="w-3.5 h-3.5" /> Quay lại đăng nhập
                            </button>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Tên đăng nhập</label>
                                <input type="text" value={regUsername} onChange={(e) => setRegUsername(e.target.value)}
                                    placeholder="Chọn username..." required autoFocus
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-all duration-200" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Mật khẩu</label>
                                <div className="relative">
                                    <input type={showRegPass ? "text" : "password"} value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                                        placeholder="Tối thiểu 6 ký tự..." required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-all duration-200" />
                                    <button type="button" onClick={() => setShowRegPass((p) => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                                        {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Xác nhận mật khẩu</label>
                                <input type="password" value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)}
                                    placeholder="Nhập lại mật khẩu..." required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-all duration-200" />
                            </div>
                            {regError && <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{regError}</div>}
                            {regSuccess && (
                                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
                                    {regSuccess}
                                    <button type="button" onClick={switchToLogin} className="block mt-1.5 text-emerald-300 font-semibold hover:underline">→ Đăng nhập ngay</button>
                                </div>
                            )}
                            <button type="submit" disabled={regLoading || !!regSuccess}
                                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm shadow-lg shadow-violet-500/25 transition-all duration-200 flex items-center justify-center gap-2">
                                {regLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Đang tạo...</> : <><UserPlus className="w-4 h-4" />Tạo tài khoản</>}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
