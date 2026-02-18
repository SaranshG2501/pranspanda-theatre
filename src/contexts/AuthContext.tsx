import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, uti: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const checkAdminRole = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (error) throw error;

    setIsAdmin(!!data);
  } catch (err) {
    console.error("Admin role check failed:", err);
    setIsAdmin(false);
  }
};


  useEffect(() => {
    const loadSession = async () => {
      console.log("Starting initial session load...");
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        console.log("Session loaded:", session ? "valid" : "null");
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log("Checking admin role for:", session.user.id);
          checkAdminRole(session.user.id);
        }
      } catch (err) {
        console.error("Critical error in loadSession:", err);
      } finally {
        console.log("→ FORCING loading = false after initial load");
        setLoading(false);
      }
    };

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("Auth state changed:", _event, session?.user?.email ?? "no user");

      setSession(session);
      setUser(session?.user ?? null);

      try {
        if (session?.user) {
          checkAdminRole(session.user.id);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error in onAuthStateChange role check:", err);
      } finally {
        console.log("→ FORCING loading = false after auth change");
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const login = async (email: string, uti: string): Promise<{ error?: string }> => {
    try {
      console.log("Login attempt:", email.trim().toLowerCase());

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          uti: uti.trim(),
        }),
      });

      console.log("Login response status:", response.status);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("Login failed - server response:", errData);
        return { error: errData.error || `Server error (${response.status})` };
      }

      const data = await response.json();
      console.log("Login response data:", data);

      if (data.error) {
        return { error: data.error };
      }

      if (!data.session?.access_token || !data.session?.refresh_token) {
        return { error: "No session tokens returned from server" };
      }

      console.log("Setting session...");

      const setSessionPromise = supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("setSession timeout")), 8000)
      );

      try {
        await Promise.race([setSessionPromise, timeoutPromise]);
      } catch (timeoutErr) {
        console.warn("setSession timed out (NavigatorLock issue) – proceeding anyway");
      }

      return {};
    } catch (err: any) {
      console.error("Login error:", err);
      return { error: err.message || "Network or unexpected error" };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("Sign out error:", error);

      setSession(null);
      setUser(null);
      setIsAdmin(false);

      localStorage.removeItem("sb-" + import.meta.env.VITE_SUPABASE_PROJECT_REF + "-auth-token");

      window.location.href = "/";
    } catch (err) {
      console.error("Logout error:", err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};