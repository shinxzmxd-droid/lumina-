import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GraduationCap, LayoutDashboard, Users, Calendar, BookOpen, LogOut, Sparkles, ClipboardCheck, FileText, BrainCircuit } from "lucide-react";
import { ReactNode } from "react";

const navByRole: Record<AppRole, { to: string; label: string; icon: any }[]> = {
  student: [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/attendance", label: "My Attendance", icon: ClipboardCheck },
    { to: "/courses", label: "Courses", icon: BookOpen },
    { to: "/materials", label: "Course Materials", icon: FileText },
    { to: "/tutor", label: "AI Tutor", icon: BrainCircuit },
    { to: "/student-leaves", label: "My Leaves", icon: FileText },
    { to: "/timetable", label: "Timetable", icon: Calendar },
  ],
  faculty: [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/courses", label: "My Courses", icon: BookOpen },
    { to: "/mark-attendance", label: "Mark Attendance", icon: ClipboardCheck },
    { to: "/leaves", label: "My Leaves", icon: FileText },
    { to: "/faculty-leaves", label: "Student Leaves", icon: FileText },
    { to: "/timetable", label: "Timetable", icon: Calendar },
  ],
  admin: [
    { to: "/dashboard", label: "Campus Overview", icon: LayoutDashboard },
    { to: "/admin/users", label: "Faculty & Roles", icon: Users },
    { to: "/admin/leaves", label: "Faculty Leaves", icon: FileText },
    { to: "/admin/timetable", label: "Timetable Generator", icon: Sparkles },
    { to: "/admin/courses", label: "Courses", icon: BookOpen },
  ],
};

export function AppShell({ children }: { children: ReactNode }) {
  const { role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const items = role ? navByRole[role] : [];

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col p-4 sticky top-0 h-screen">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none">Lumina</div>
            <div className="text-xs text-sidebar-foreground/60">Campus OS</div>
          </div>
        </Link>

        <nav className="flex-1 space-y-1">
          {items.map((it) => {
            const active = loc.pathname === it.to;
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-elegant"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border pt-4 mt-4">
          <div className="px-2 pb-3">
            <div className="text-sm font-medium truncate">{user?.email}</div>
            <div className="text-xs text-sidebar-foreground/60 capitalize">{role}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
