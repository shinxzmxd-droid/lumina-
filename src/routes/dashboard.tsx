import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Users, BookOpen, ClipboardCheck, Sparkles, FileText, TrendingUp, ArrowUpRight, CalendarDays, Mic } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { HolidaysCalendar } from "@/components/HolidaysCalendar";

export const Route = createFileRoute("/dashboard")({
  component: () => <RequireAuth><DashboardRouter /></RequireAuth>,
});

function DashboardRouter() {
  const { role } = useAuth();
  if (role === "admin") return <AdminDash />;
  if (role === "faculty") return <FacultyDash />;
  return <StudentDash />;
}

function StatCard({ icon: Icon, label, value, hint, accent }: any) {
  return (
    <Card className="p-5 shadow-elegant">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-3xl font-bold font-display mt-1">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div className={`w-10 h-10 rounded-lg grid place-items-center ${accent ?? "bg-primary/10 text-primary"}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

function StudentDash() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: att } = await supabase.from("attendance")
        .select("present, session_date, course_id, courses(name, code)")
        .eq("student_id", user.id)
        .order("session_date", { ascending: false });
      setRows(att ?? []);
      const { data: en } = await supabase.from("enrollments")
        .select("courses(id,name,code)").eq("student_id", user.id);
      setCourses(en ?? []);
    })();
  }, [user]);

  const total = rows.length;
  const present = rows.filter(r => r.present).length;
  const pct = total ? Math.round((present/total)*100) : 0;

  const byCourse: Record<string, { name: string; present: number; total: number }> = {};
  rows.forEach((r: any) => {
    const k = r.courses?.code ?? "?";
    if (!byCourse[k]) byCourse[k] = { name: k, present: 0, total: 0 };
    byCourse[k].total++;
    if (r.present) byCourse[k].present++;
  });
  const courseChart = Object.values(byCourse).map(c => ({ name: c.name, attendance: Math.round((c.present/c.total)*100) }));

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 p-6 md:p-10 min-h-[calc(100vh-4rem)] bg-pastel-cream text-pastel-ink">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold font-display">Welcome Back 👋</h1>
            <p className="text-pastel-muted mt-1">Here's your learning snapshot.</p>
          </div>
          <div className="hidden md:flex items-center gap-3 bg-white rounded-2xl px-5 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wider text-pastel-muted">Attendance</div>
            <div className="text-2xl font-bold">{pct}%</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <PastelTile to="/attendance" tone="bg-pastel-yellow" icon={ClipboardCheck} title="Attendance" subtitle={`${present}/${total} sessions · ${pct}%`} />
          <PastelTile to="/timetable" tone="bg-pastel-mint" icon={CalendarDays} title="Timetable" subtitle="View your weekly schedule" />
          <PastelTile to="/courses" tone="bg-pastel-lilac" icon={BookOpen} title="Materials" subtitle={`${courses.length} enrolled courses`} />
          <PastelTile to="/tutor" tone="bg-pastel-pink" icon={Mic} title="AI Tutor" subtitle="Voice + chat ready" />
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl font-bold">Attendance by course</h3>
            <span className={`text-xs px-3 py-1 rounded-full ${pct>=75 ? "bg-pastel-mint" : "bg-pastel-pink"}`}>
              {pct >= 75 ? "On track" : "At risk"}
            </span>
          </div>
          {courseChart.length === 0 ? (
            <p className="text-sm text-pastel-muted">No attendance recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={courseChart}>
                <XAxis dataKey="name" stroke="currentColor" opacity={0.5} />
                <YAxis stroke="currentColor" opacity={0.5} />
                <Tooltip />
                <Bar dataKey="attendance" fill="oklch(0.78 0.12 295)" radius={[12,12,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function PastelTile({ to, tone, icon: Icon, title, subtitle }: { to: string; tone: string; icon: any; title: string; subtitle: string }) {
  return (
    <Link to={to} className={`group relative ${tone} rounded-3xl p-6 shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col gap-6 min-h-[160px]`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/60 grid place-items-center">
          <Icon className="w-5 h-5 text-pastel-ink" />
        </div>
        <span className="text-xs uppercase tracking-wider text-pastel-ink/60">Open</span>
      </div>
      <div className="mt-auto flex items-end justify-between">
        <div>
          <h3 className="text-xl font-bold font-display text-pastel-ink">{title}</h3>
          <p className="text-sm text-pastel-ink/70 mt-1">{subtitle}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-pastel-ink text-white grid place-items-center group-hover:scale-110 transition-transform">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}

function PastelStat({ tone, icon: Icon, label, value, hint }: { tone: string; icon: any; label: string; value: number | string; hint?: string }) {
  return (
    <div className={`${tone} rounded-3xl p-6 shadow-sm flex flex-col gap-6 min-h-[160px]`}>
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-full bg-white/60 grid place-items-center">
          <Icon className="w-5 h-5 text-pastel-ink" />
        </div>
        <span className="text-xs uppercase tracking-wider text-pastel-ink/60">{label}</span>
      </div>
      <div className="mt-auto">
        <div className="text-4xl font-bold font-display text-pastel-ink leading-none">{value}</div>
        {hint && <div className="text-sm text-pastel-ink/70 mt-2">{hint}</div>}
      </div>
    </div>
  );
}

function FacultyDash() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ courses: 0, students: 0, sessions: 0, leaves: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: courses } = await supabase.from("courses").select("id").eq("faculty_id", user.id);
      const courseIds = (courses ?? []).map(c => c.id);
      const [{ count: studentsC }, { count: sessC }, { count: leavesC }] = await Promise.all([
        supabase.from("enrollments").select("*", { count: "exact", head: true }).in("course_id", courseIds.length ? courseIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("attendance").select("*", { count: "exact", head: true }).in("course_id", courseIds.length ? courseIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("leaves").select("*", { count: "exact", head: true }).eq("faculty_id", user.id),
      ]);
      setStats({ courses: courses?.length ?? 0, students: studentsC ?? 0, sessions: sessC ?? 0, leaves: leavesC ?? 0 });
    })();
  }, [user]);

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 p-6 md:p-10 min-h-[calc(100vh-4rem)] bg-pastel-cream text-pastel-ink">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold font-display">Faculty workspace ✨</h1>
            <p className="text-pastel-muted mt-1">Manage your courses, students and attendance.</p>
          </div>
          <div className="hidden md:flex items-center gap-3 bg-white rounded-2xl px-5 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wider text-pastel-muted">Students</div>
            <div className="text-2xl font-bold">{stats.students}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <PastelStat tone="bg-pastel-yellow" icon={BookOpen} label="My Courses" value={stats.courses} hint="Active this term" />
          <PastelStat tone="bg-pastel-mint" icon={Users} label="Students" value={stats.students} hint="Across all courses" />
          <PastelStat tone="bg-pastel-lilac" icon={ClipboardCheck} label="Sessions" value={stats.sessions} hint="Attendance logged" />
          <PastelStat tone="bg-pastel-pink" icon={FileText} label="Leaves" value={stats.leaves} hint="Total requests" />
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <PastelTile to="/mark-attendance" tone="bg-pastel-mint" icon={ClipboardCheck} title="Mark attendance" subtitle="Log today's session quickly" />
          <PastelTile to="/admin/courses" tone="bg-pastel-lilac" icon={BookOpen} title="My courses" subtitle="Materials & enrollments" />
        </div>
      </div>
    </div>
  );
}

const PASTEL_COLORS = ["oklch(0.92 0.06 95)","oklch(0.92 0.05 165)","oklch(0.9 0.06 295)","oklch(0.9 0.06 15)"];

function AdminDash() {
  const [counts, setCounts] = useState({ users: 0, courses: 0, attendance: 0, ai: 0 });
  const [trend, setTrend] = useState<any[]>([]);
  const [pie, setPie] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ count: u }, { count: c }, { count: a }, { count: ai }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("courses").select("*", { count: "exact", head: true }),
        supabase.from("attendance").select("*", { count: "exact", head: true }),
        supabase.from("ai_interactions").select("*", { count: "exact", head: true }),
      ]);
      setCounts({ users: u ?? 0, courses: c ?? 0, attendance: a ?? 0, ai: ai ?? 0 });

      const { data: rows } = await supabase.from("attendance").select("session_date, present").order("session_date").limit(500);
      const map: Record<string, { date: string; pct: number; tot: number; pres: number }> = {};
      (rows ?? []).forEach((r: any) => {
        const d = r.session_date;
        if (!map[d]) map[d] = { date: d, pct: 0, tot: 0, pres: 0 };
        map[d].tot++;
        if (r.present) map[d].pres++;
      });
      setTrend(Object.values(map).map(m => ({ date: m.date.slice(5), attendance: Math.round((m.pres/m.tot)*100) })).slice(-14));

      const { data: roles } = await supabase.from("user_roles").select("role");
      const rmap: Record<string, number> = {};
      (roles ?? []).forEach((r: any) => { rmap[r.role] = (rmap[r.role] ?? 0) + 1; });
      setPie(Object.entries(rmap).map(([name, value]) => ({ name, value })));
    })();
  }, []);

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 p-6 md:p-10 min-h-[calc(100vh-4rem)] bg-pastel-cream text-pastel-ink">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold font-display">Campus overview 🎓</h1>
            <p className="text-pastel-muted mt-1">Real-time institutional metrics.</p>
          </div>
          <div className="hidden md:flex items-center gap-3 bg-white rounded-2xl px-5 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-wider text-pastel-muted">Users</div>
            <div className="text-2xl font-bold">{counts.users}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <PastelStat tone="bg-pastel-yellow" icon={Users} label="Total Users" value={counts.users} hint="All roles combined" />
          <PastelStat tone="bg-pastel-mint" icon={BookOpen} label="Courses" value={counts.courses} hint="Active catalogue" />
          <PastelStat tone="bg-pastel-lilac" icon={ClipboardCheck} label="Attendance" value={counts.attendance} hint="Entries logged" />
          <PastelStat tone="bg-pastel-pink" icon={Sparkles} label="AI Engagements" value={counts.ai} hint="Tutor sessions" />
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl font-bold">Attendance trend</h3>
              <span className="text-xs px-3 py-1 rounded-full bg-pastel-mint">Last 14 days</span>
            </div>
            {trend.length === 0 ? <p className="text-sm text-pastel-muted">No data yet.</p> : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend}>
                  <XAxis dataKey="date" stroke="currentColor" opacity={0.4} />
                  <YAxis stroke="currentColor" opacity={0.4} />
                  <Tooltip />
                  <Line type="monotone" dataKey="attendance" stroke="oklch(0.65 0.15 295)" strokeWidth={3} dot={{ r: 4, fill: "oklch(0.65 0.15 295)" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl font-bold">Users by role</h3>
            </div>
            {pie.length === 0 ? <p className="text-sm text-pastel-muted">No users yet.</p> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {pie.map((_, i) => <Cell key={i} fill={PASTEL_COLORS[i % PASTEL_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <PastelTile to="/admin/users" tone="bg-pastel-yellow" icon={Users} title="Faculty & Roles" subtitle="Manage users" />
          <PastelTile to="/admin/courses" tone="bg-pastel-mint" icon={BookOpen} title="Courses" subtitle="Catalogue & enrol" />
          <PastelTile to="/admin/timetable" tone="bg-pastel-lilac" icon={CalendarDays} title="AI Timetable" subtitle="Generate schedule" />
          <PastelTile to="/admin/leaves" tone="bg-pastel-pink" icon={FileText} title="Leave Requests" subtitle="Review & approve" />
        </div>
      </div>
    </div>
  );
}
