import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { AppShell } from "./AppShell";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: AppRole[] }) {
  const { user, role, approved, loading, signOut } = useAuth();
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

  if (!approved) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-hero text-primary-foreground p-6">
        <div className="max-w-md text-center glass rounded-2xl p-8">
          <Clock className="w-10 h-10 mx-auto mb-4 text-accent" />
          <h1 className="text-2xl font-bold font-display mb-2">Awaiting approval</h1>
          <p className="text-primary-foreground/70 mb-6">
            Your account ({role}) is pending admin approval. You'll be able to sign in once an admin approves it.
          </p>
          <Button variant="secondary" onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
            Sign out
          </Button>
        </div>
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
