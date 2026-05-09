import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/attendance")({
  component: () => <RequireAuth roles={["student"]}><Page /></RequireAuth>,
});

const MIN_PCT = 75;

function Page() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  
  const [upcomingBySubject, setUpcomingBySubject] = useState<Record<string, number>>({});
  // Per-class toggles: key = `${course_id}|${YYYY-MM-DD}` -> boolean (will attend)
  const [dayPlan, setDayPlan] = useState<Record<string, boolean>>({});
  const [upcomingClasses, setUpcomingClasses] = useState<Array<{ key: string; course_id: string; date: string; dow: number }>>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("attendance")
      .select("*, courses(name, code)")
      .eq("student_id", user.id)
      .order("session_date", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, [user]);

  const bySubject = useMemo(() => {
    const map: Record<string, { id: string; code: string; name: string; total: number; present: number }> = {};
    rows.forEach((r) => {
      const k = r.course_id;
      if (!map[k]) map[k] = { id: k, code: r.courses?.code ?? "?", name: r.courses?.name ?? "", total: 0, present: 0 };
      map[k].total++;
      if (r.present) map[k].present++;
    });
    return Object.values(map).map((s) => ({ ...s, pct: s.total ? Math.round((s.present / s.total) * 100) : 0 }));
  }, [rows]);

  useEffect(() => {
    setPlan((prev) => {
      const next = { ...prev };
      bySubject.forEach((s) => { if (next[s.id] === undefined) next[s.id] = 100; });
      return next;
    });
  }, [bySubject]);

  // Fetch upcoming class instances (next 2 weeks) per subject
  useEffect(() => {
    if (!user || bySubject.length === 0) return;
    const courseIds = bySubject.map((s) => s.id);
    supabase.from("timetable_slots")
      .select("day_of_week, course_id")
      .in("course_id", courseIds)
      .then(({ data }) => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const counts: Record<string, number> = {};
        const instances: Array<{ key: string; course_id: string; date: string; dow: number }> = [];
        for (let i = 1; i <= 14; i++) {
          const d = new Date(today); d.setDate(today.getDate() + i);
          const dow = d.getDay();
          const iso = d.toISOString().slice(0, 10);
          (data ?? []).filter((s: any) => Number(s.day_of_week) === dow).forEach((s: any) => {
            counts[s.course_id] = (counts[s.course_id] ?? 0) + 1;
            instances.push({ key: `${s.course_id}|${iso}`, course_id: s.course_id, date: iso, dow });
          });
        }
        setUpcomingBySubject(counts);
        setUpcomingClasses(instances);
        setDayPlan((prev) => {
          const next = { ...prev };
          instances.forEach((c) => { if (next[c.key] === undefined) next[c.key] = true; });
          return next;
        });
      });
  }, [user, bySubject.length]);

  const overallTotal = rows.length;
  const overallPresent = rows.filter(r => r.present).length;
  const overallPct = overallTotal ? Math.round((overallPresent / overallTotal) * 100) : 0;

  const projection = useMemo(() => {
    let projPresent = overallPresent;
    let projTotal = overallTotal;
    const perSubject = bySubject.map((s) => {
      const upcoming = upcomingClasses.filter((c) => c.course_id === s.id);
      const willAttend = upcoming.filter((c) => dayPlan[c.key]).length;
      const newPresent = s.present + willAttend;
      const newTotal = s.total + upcoming.length;
      projPresent += willAttend;
      projTotal += upcoming.length;
      return {
        ...s,
        upcoming: upcoming.length,
        willAttend,
        upcomingClasses: upcoming,
        projPct: newTotal ? Math.round((newPresent / newTotal) * 100) : 0,
      };
    });
    const projOverall = projTotal ? Math.round((projPresent / projTotal) * 100) : 0;
    return { perSubject, projOverall };
  }, [bySubject, dayPlan, upcomingClasses, overallPresent, overallTotal]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">My attendance</h1>
        <p className="text-muted-foreground">Minimum required: <strong>{MIN_PCT}%</strong> per subject (VTU norm)</p>
      </div>

      <Card className={`p-6 border-2 ${overallPct >= MIN_PCT ? "border-success/30" : "border-destructive/40"}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Overall attendance</div>
            <div className="text-4xl font-display font-bold mt-1">{overallPct}%</div>
            <div className="text-xs text-muted-foreground">{overallPresent} present / {overallTotal} sessions</div>
          </div>
          {overallPct >= MIN_PCT
            ? <Badge className="bg-success text-success-foreground"><CheckCircle2 className="w-3 h-3 mr-1" /> Eligible</Badge>
            : <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> Below {MIN_PCT}%</Badge>}
        </div>
        <Progress value={overallPct} className="h-2" />
      </Card>

      <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold">Attendance Predictor</h3>
            <p className="text-sm text-muted-foreground">Toggle the days you plan to attend per subject for the next 2 weeks. Your projected attendance updates live.</p>
          </div>
        </div>

        {bySubject.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance records yet to predict from.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-6 flex-wrap p-4 rounded-xl bg-background/60">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Current</div>
                <div className="text-2xl font-bold font-display text-muted-foreground">{overallPct}%</div>
              </div>
              <div className="text-2xl text-muted-foreground">→</div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Projected overall</div>
                <div className={`text-4xl font-bold font-display ${projection.projOverall >= MIN_PCT ? "text-success" : "text-destructive"}`}>
                  {projection.projOverall}%
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {projection.perSubject.map((s) => {
                const pct = s.upcoming ? Math.round((s.willAttend / s.upcoming) * 100) : 100;
                return (
                <div key={s.id} className="rounded-lg bg-background border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-display font-semibold text-sm">{s.code}</div>
                      <div className="text-xs text-muted-foreground">{s.upcoming} upcoming classes</div>
                    </div>
                    <div className={`text-xl font-bold font-display ${s.projPct >= MIN_PCT ? "text-success" : "text-destructive"}`}>
                      {s.projPct}%
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>Plan to attend</span>
                      <span><strong>{s.willAttend}/{s.upcoming}</strong> ({pct}%)</span>
                    </div>
                    {s.upcomingClasses.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No classes in next 2 weeks.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {s.upcomingClasses.map((c) => {
                          const d = new Date(c.date);
                          const label = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
                          const on = dayPlan[c.key] ?? true;
                          return (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => setDayPlan((p) => ({ ...p, [c.key]: !on }))}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                on
                                  ? "bg-success text-success-foreground border-success"
                                  : "bg-background text-muted-foreground border-border hover:bg-muted"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => {
                const next: Record<string, boolean> = {};
                upcomingClasses.forEach((c) => { next[c.key] = true; });
                setDayPlan(next); toast.success("Marked all days as attending");
              }}>Attend all days</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const next: Record<string, boolean> = {};
                upcomingClasses.forEach((c) => { next[c.key] = false; });
                setDayPlan(next);
              }}>Skip all</Button>
              <Button size="sm" variant="outline" onClick={() => {
                // Skip weekends only
                const next: Record<string, boolean> = { ...dayPlan };
                upcomingClasses.forEach((c) => { next[c.key] = c.dow !== 0 && c.dow !== 6; });
                setDayPlan(next);
              }}>Weekdays only</Button>
            </div>
          </div>
        )}
      </Card>

      <div>
        <h2 className="font-display font-semibold mb-3">Subject-wise attendance</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {bySubject.length === 0 && <Card className="p-6 text-center text-muted-foreground col-span-full">No records yet.</Card>}
          {bySubject.map(s => {
            const ok = s.pct >= MIN_PCT;
            return (
              <Card key={s.code} className={`p-5 ${ok ? "" : "ring-1 ring-destructive/40"}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-display font-semibold">{s.code}</div>
                    <div className="text-xs text-muted-foreground">{s.name}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold font-display ${ok ? "text-success" : "text-destructive"}`}>{s.pct}%</div>
                    <div className="text-xs text-muted-foreground">{s.present}/{s.total}</div>
                  </div>
                </div>
                <Progress value={s.pct} className="h-2" />
                {!ok && (
                  <div className="text-xs text-destructive mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Need {MIN_PCT - s.pct}% more to meet minimum
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-display font-semibold mb-3">Recent sessions</h2>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr><th className="text-left p-3">Date</th><th className="text-left p-3">Course</th><th className="text-left p-3">Status</th></tr>
            </thead>
            <tbody>
              {(() => {
                const latest = rows[0]?.session_date;
                return rows.filter(r => r.session_date === latest);
              })().map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.session_date}</td>
                  <td className="p-3">{r.courses?.code} — {r.courses?.name}</td>
                  <td className="p-3">
                    {r.present
                      ? <Badge className="bg-success text-success-foreground">Present</Badge>
                      : <Badge variant="destructive">Absent</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
