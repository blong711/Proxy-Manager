"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Globe,
    Users,
    Building2,
    Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/proxies", label: "Proxies", icon: Globe },
    { href: "/accounts", label: "Accounts", icon: Users },
    { href: "/providers", label: "Providers", icon: Building2 },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 shrink-0 border-r border-white/5 bg-[#0d1426] flex flex-col">
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                    <Shield className="w-4 h-4 text-white" />
                </div>
                <div>
                    <p className="font-semibold text-sm text-white tracking-wide">ProxyManager</p>
                    <p className="text-[10px] text-slate-500">v1.0 MVP</p>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href;
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                active
                                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/20"
                                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                            )}
                        >
                            <Icon className={cn("w-4 h-4", active ? "text-violet-400" : "")} />
                            {label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-white/5">
                <p className="text-[11px] text-slate-600 text-center">
                    Better than Google Sheets 🚀
                </p>
            </div>
        </aside>
    );
}
