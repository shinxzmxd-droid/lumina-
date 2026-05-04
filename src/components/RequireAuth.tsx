import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { AppShell } from "./AppShell";

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: AppRole[] }) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user || !role) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-hero text-primary-foreground">
        <div className="animate-pulse">Loading…</div>
      </div>
    );
  }

  if (roles && !roles.includes(role)) {
    return (
      <AppShell>
        <div className="text-center py-20">
          <h1 className="text-3xl font-bold mb-2">Access denied</h1>
          <p className="text-muted-foreground">Your role ({role}) cannot view this page.</p>
        </div>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}
