import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { GraduationCap, LayoutDashboard, Users, Calendar, BookOpen, LogOut, Sparkles, ClipboardCheck, FileText, BrainCircuit, Menu, Megaphone, Award } from "lucide-react";
import { ReactNode, useState } from "react";

const navByRole: Record<AppRole, { to: string; label: string; icon: any }[]> = {
  student: [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/attendance", label: "My Attendance", icon: ClipboardCheck },
    { to: "/courses", label: "Courses", icon: BookOpen },
    { to: "/materials", label: "Course Materials", icon: FileText },
    { to: "/tutor", label: "AI Tutor", icon: BrainCircuit },
    { to: "/student-leaves", label: "My Leaves", icon: FileText },
    { to: "/timetable", label: "Timetable", icon: Calendar },
    { to: "/announcements", label: "Announcements", icon: Megaphone },
    { to: "/results", label: "My Results", icon: Award },
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/courses", label: "My Courses", icon: BookOpen },
    { to: "/faculty/students", label: "My Students", icon: Users },
    { to: "/faculty/timetable", label: "Edit Timetable", icon: Calendar },
    { to: "/mark-attendance", label: "Mark Attendance", icon: ClipboardCheck },
    { to: "/leaves", label: "My Leaves", icon: FileText },
    { to: "/faculty-leaves", label: "Student Leaves", icon: FileText },
    { to: "/timetable", label: "Timetable", icon: Calendar },
    { to: "/announcements", label: "Announcements", icon: Megaphone },
  ],
  admin: [
    { to: "/dashboard", label: "Campus Overview", icon: LayoutDashboard },
    { to: "/admin/users", label: "Faculty & Roles", icon: Users },
    { to: "/admin/leaves", label: "Faculty Leaves", icon: FileText },
    { to: "/admin/timetable", label: "Timetable Generator", icon: Sparkles },
    { to: "/admin/courses", label: "Courses", icon: BookOpen },
    { to: "/announcements", label: "Announcements", icon: Megaphone },
  ],
};

function NavList({ items, pathname, onNavigate }: { items: any[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1">
      {items.map((it) => {
        const active = pathname === it.to;
        const Icon = it.icon;
        return (
          <Link
            key={it.to}
            to={it.to}
            onClick={onNavigate}
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
  );
}

function SidebarInner({ items, pathname, user, role, onSignOut, onNavigate }: any) {
  return (
    <div className="flex flex-col h-full p-4 bg-sidebar text-sidebar-foreground">
      <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2 px-2 py-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
          <GraduationCap className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <div className="font-display font-bold text-lg leading-none">Lumina</div>
        </div>
      </Link>
      <NavList items={items} pathname={pathname} onNavigate={onNavigate} />
      <div className="border-t border-sidebar-border pt-4 mt-4">
        <div className="px-2 pb-3">
          <div className="text-sm font-medium truncate">{user?.email}</div>
          <div className="text-xs text-sidebar-foreground/60 capitalize">{role}</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={onSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const items = role ? navByRole[role] : [];
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => { await signOut(); navigate({ to: "/auth" }); };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col sticky top-0 h-screen">
        <SidebarInner items={items} pathname={loc.pathname} user={user} role={role} onSignOut={handleSignOut} />
      </aside>

      <main className="flex-1 overflow-x-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary grid place-items-center">
              <GraduationCap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold">Lumina</span>
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
              <SidebarInner items={items} pathname={loc.pathname} user={user} role={role} onSignOut={handleSignOut} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
