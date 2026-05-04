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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Hi there 👋</h1>
        <p className="text-muted-foreground">Here's your learning snapshot.</p>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard icon={ClipboardCheck} label="Attendance" value={`${pct}%`} hint={`${present}/${total} sessions`} accent="bg-success/10 text-success" />
        <StatCard icon={BookOpen} label="Enrolled courses" value={courses.length} accent="bg-primary/10 text-primary" />
        <StatCard icon={Sparkles} label="AI tutor" value="Ready" hint="Voice + chat" accent="bg-accent/20 text-accent-foreground" />
        <StatCard icon={TrendingUp} label="Status" value={pct >= 75 ? "On track" : "At risk"} accent={pct>=75 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"} />
      </div>
      <Card className="p-6">
        <h3 className="font-display font-semibold mb-4">Attendance by course</h3>
        {courseChart.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={courseChart}>
              <XAxis dataKey="name" stroke="currentColor" opacity={0.5} />
              <YAxis stroke="currentColor" opacity={0.5} />
              <Tooltip />
              <Bar dataKey="attendance" fill="oklch(0.55 0.18 220)" radius={[8,8,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Faculty workspace</h1>
        <p className="text-muted-foreground">Manage your courses and attendance.</p>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="My courses" value={stats.courses} accent="bg-primary/10 text-primary" />
        <StatCard icon={Users} label="Total students" value={stats.students} accent="bg-success/10 text-success" />
        <StatCard icon={ClipboardCheck} label="Sessions logged" value={stats.sessions} accent="bg-accent/20 text-accent-foreground" />
        <StatCard icon={FileText} label="Leave requests" value={stats.leaves} accent="bg-warning/20 text-warning-foreground" />
      </div>
      <Card className="p-6">
        <h3 className="font-display font-semibold mb-2">Quick actions</h3>
        <p className="text-sm text-muted-foreground">Use the sidebar to mark attendance, manage courses, or apply for leave.</p>
      </Card>
    </div>
  );
}

const COLORS = ["oklch(0.55 0.18 220)","oklch(0.78 0.16 75)","oklch(0.7 0.18 155)","oklch(0.6 0.22 25)"];

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Campus overview</h1>
        <p className="text-muted-foreground">Real-time institutional metrics.</p>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total users" value={counts.users} accent="bg-primary/10 text-primary" />
        <StatCard icon={BookOpen} label="Courses" value={counts.courses} accent="bg-success/10 text-success" />
        <StatCard icon={ClipboardCheck} label="Attendance entries" value={counts.attendance} accent="bg-accent/20 text-accent-foreground" />
        <StatCard icon={Sparkles} label="AI engagements" value={counts.ai} accent="bg-warning/20 text-warning-foreground" />
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">Attendance trend (last 14 days)</h3>
          {trend.length === 0 ? <p className="text-sm text-muted-foreground">No data yet.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend}>
                <XAxis dataKey="date" stroke="currentColor" opacity={0.5} />
                <YAxis stroke="currentColor" opacity={0.5} />
                <Tooltip />
                <Line type="monotone" dataKey="attendance" stroke="oklch(0.55 0.18 220)" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-6">
          <h3 className="font-display font-semibold mb-4">Users by role</h3>
          {pie.length === 0 ? <p className="text-sm text-muted-foreground">No users yet.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                  {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
