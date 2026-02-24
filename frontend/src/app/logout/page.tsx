"use client";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Clear all proxy manager related storage
    localStorage.removeItem("pm_token");
    sessionStorage.clear();
    
    // Call logout function
    logout();
    
    // Redirect to home after logout
    setTimeout(() => {
      router.push("/");
    }, 1000);
  }, [logout, router]);

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-violet-500/10 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">Đang đăng xuất...</h1>
        <p className="text-slate-400 text-sm">Vui lòng đợi trong giây lát</p>
      </div>
    </div>
  );
}