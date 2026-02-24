"use client";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";

const PUBLIC_ROUTES = ["/login", "/logout"];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublic = PUBLIC_ROUTES.includes(pathname);

    if (isPublic) {
        return <>{children}</>;
    }

    return (
        <AuthGuard>
            <div className="flex h-screen overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
            </div>
        </AuthGuard>
    );
}