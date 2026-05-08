import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "faculty" | "student";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  approved: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, session: null, role: null, approved: false, loading: true, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [approved, setApproved] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const fetchRoleAndApproval = async (uid: string) => {
    try {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid).order("role").limit(1).maybeSingle(),
        supabase.from("profiles").select("approved").eq("user_id", uid).maybeSingle(),
      ]);
      setRole((r?.role as AppRole) ?? "student");
      setApproved(!!p?.approved);
    } catch (e) {
      console.error("fetchRoleAndApproval failed", e);
      setRole("student");
      setApproved(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setLoading(true);
        setTimeout(() => fetchRoleAndApproval(s.user.id), 0);
      } else {
        setRole(null);
        setApproved(false);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await fetchRoleAndApproval(data.session.user.id);
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{
      user: session?.user ?? null,
      session, role, approved, loading,
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
