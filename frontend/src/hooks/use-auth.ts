"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores";
import { apiClient, ApiError } from "@/lib/api-client";
import type { User, LoginRequest, RegisterRequest } from "@/types";
import { ROUTES } from "@/lib/constants";

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } =
    useAuthStore();

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await apiClient.get<User>("/auth/me");
        setUser(userData);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          // Access token may be expired — try refresh before logging out
          try {
            await apiClient.post("/auth/refresh");
            const userData = await apiClient.get<User>("/auth/me");
            setUser(userData);
          } catch {
            setUser(null);
          }
        } else {
          // Network error — don't log the user out, just stop loading
          setLoading(false);
        }
      }
    };

    if (isLoading) {
      checkAuth();
    }
  }, [isLoading, setUser, setLoading]);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      setLoading(true);
      try {
        const response = await apiClient.post<{ user: User; message: string }>(
          "/auth/login",
          credentials
        );
        // Backend may not return user in login response — fetch it if missing
        const user = response.user ?? (await apiClient.get<User>("/auth/me"));
        setUser(user);
        const destination = user.user_type === "promoter" ? ROUTES.PROMOTER_DASHBOARD : ROUTES.DASHBOARD;
        router.push(destination);
        return response;
      } catch (error) {
        setLoading(false);
        throw error;
      }
    },
    [router, setUser, setLoading]
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      const response = await apiClient.post<{ id: string; email: string }>(
        "/auth/register",
        data
      );
      return response;
    },
    []
  );

  const handleLogout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Ignore logout errors
    } finally {
      logout();
      router.push(ROUTES.LOGIN);
    }
  }, [logout, router]);

  const refreshToken = useCallback(async () => {
    try {
      await apiClient.post("/auth/refresh");
      // Re-fetch user after token refresh
      const userData = await apiClient.get<User>("/auth/me");
      setUser(userData);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        router.push(ROUTES.LOGIN);
      }
      return false;
    }
  }, [logout, router, setUser]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout: handleLogout,
    refreshToken,
  };
}
