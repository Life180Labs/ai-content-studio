/**
 * Auth store — Zustand state management for authentication.
 */

import { create } from "zustand";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  verifyEmail: (email: string, otp: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const data = await api.post<{
      access_token: string;
      refresh_token: string;
    }>("/api/v1/auth/login", { email, password });

    api.setTokens(data.access_token, data.refresh_token);

    // Fetch user profile
    const user = await api.get<User>("/api/v1/auth/me");
    set({ user, isAuthenticated: true, isLoading: false });
  },

  register: async (email, password, fullName) => {
    await api.post("/api/v1/auth/register", {
      email,
      password,
      full_name: fullName,
    });
  },

  verifyEmail: async (email, otp) => {
    await api.post("/api/v1/auth/verify-email", { email, otp });
  },

  resendOtp: async (email) => {
    await api.post("/api/v1/auth/resend-otp", { email });
  },

  logout: async () => {
    try {
      await api.post("/api/v1/auth/logout");
    } catch {
      // Ignore errors during logout
    }
    api.clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  fetchUser: async () => {
    try {
      const user = await api.get<User>("/api/v1/auth/me");
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      api.clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  reset: () => {
    api.clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
}));
