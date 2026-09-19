import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      setUser(null);
      localStorage.removeItem("pf_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const applyAuth = (data) => {
    if (data.token) localStorage.setItem("pf_token", data.token);
    setUser(data.user);
  };

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    applyAuth(res.data);
    return res.data.user;
  };

  const register = async (email, name, password) => {
    const res = await api.post("/auth/register", { email, name, password });
    applyAuth(res.data);
    return res.data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("pf_token");
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    const res = await api.get("/auth/me");
    setUser(res.data);
    return res.data;
  }, []);

  const setUserData = (u) => setUser(u);

  const isPremium = user?.subscriptionTier === "premium";

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, setUserData, isPremium, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
