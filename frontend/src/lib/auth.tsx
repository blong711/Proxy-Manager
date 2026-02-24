"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export type UserRole = "user" | "admin";

interface AuthUser {
  username: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const setupAxiosInterceptor = useCallback((token: string | null) => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
  }, []);

  // On mount, check if token already in localStorage
  useEffect(() => {
    const token = localStorage.getItem("pm_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    setupAxiosInterceptor(token);
    api
      .get("/api/auth/me")
      .then((res) => {
        setUser({ username: res.data.username, role: res.data.role });
      })
      .catch(() => {
        localStorage.removeItem("pm_token");
        setupAxiosInterceptor(null);
      })
      .finally(() => setIsLoading(false));
  }, [setupAxiosInterceptor]);

  const login = async (username: string, password: string) => {
    try {
      // Clear any cached data from previous user before logging in
      queryClient.clear();
      const res = await api.post("/api/auth/login", { username, password });
      const { access_token, username: uname, role } = res.data;
      localStorage.setItem("pm_token", access_token);
      setupAxiosInterceptor(access_token);
      setUser({ username: uname, role });
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === "ERR_NETWORK") {
        throw new Error("Network error: Unable to connect to server. Please check if the backend is running.");
      }
      if (error.response?.status === 401) {
        throw new Error("Invalid username or password");
      }
      if (error.response?.status >= 500) {
        throw new Error("Server error: Please try again later");
      }
      throw new Error(error.response?.data?.detail || error.message || "Login failed");
    }
  };

  const logout = () => {
    localStorage.removeItem("pm_token");
    setupAxiosInterceptor(null);
    setUser(null);
    // Clear ALL cached query data so next user doesn't see previous user's data
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
