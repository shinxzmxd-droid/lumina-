import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/attendance")({
  component: () => <RequireAuth roles={["student"]}><Page /></RequireAuth>,
});

const MIN_PCT = 75;

function Page() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("attendance")
      .select("*, courses(name, code)")
      .eq("student_id", user.id)
      .order("session_date", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, [user]);

  const bySubject = useMemo(() => {
    const map: Record<string, { code: string; name: string; total: number; present: number }> = {};
    rows.forEach((r) => {
      const k = r.course_id;
      if (!map[k]) map[k] = { code: r.courses?.code ?? "?", name: r.courses?.name ?? "", total: 0, present: 0 };
      map[k].total++;
      if (r.present) map[k].present++;
    });
    return Object.values(map).map((s) => ({ ...s, pct: s.total ? Math.round((s.present / s.total) * 100) : 0 }));
  }, [rows]);

  const overallTotal = rows.length;
  const overallPresent = rows.filter(r => r.present).length;
  const overallPct = overallTotal ? Math.round((overallPresent / overallTotal) * 100) : 0;

  const runPrediction = async () => {
    if (!user) return;
    if (bySubject.length === 0) {
      toast.error("No attendance data yet to predict from");
      return;
    }
    setPredicting(true);
    try {
      const courseIds = Array.from(new Set(rows.map(r => r.course_id)));
      const { data: slotsRaw } = await supabase
        .from("timetable_slots")
        .select("day_of_week, start_time, end_time, room, course_id, courses(code)")
        .in("course_id", courseIds);
      const slots = (slotsRaw ?? []).map((s: any) => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        room: s.room,
        code: s.courses?.code ?? "?",
      }));
      if (slots.length === 0) {
        toast.error("No timetable found for your courses");
        setPredicting(false);
        return;
      }
      const subjects = bySubject.map(s => ({ code: s.code, name: s.name, total: s.total, present: s.present, current_pct: s.pct }));
      const { data, error } = await supabase.functions.invoke("predict-attendance", {
        body: { subjects, slots, weeksAhead: 2 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setPrediction((data as any).prediction);
      toast.success("AI forecast ready");
    } catch (e: any) {
      toast.error(e.message ?? "Prediction failed");
    } finally {
      setPredicting(false);
    }
  };

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
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-semibold">AI Attendance Predictor</h3>
              <p className="text-sm text-muted-foreground">Predicts your next 2 weeks of classes based on timetable + history.</p>
            </div>
          </div>
          <Button onClick={runPrediction} disabled={predicting}>
            {predicting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Predicting…</> : <><Sparkles className="w-4 h-4 mr-2" /> Predict next 2 weeks</>}
          </Button>
        </div>

        {prediction && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Predicted overall</div>
                <div className="text-3xl font-bold font-display">{prediction.overall_predicted_pct}%</div>
              </div>
              <Badge variant={prediction.risk_level === "high" ? "destructive" : "secondary"} className={prediction.risk_level === "low" ? "bg-success text-success-foreground" : ""}>
                {prediction.risk_level} risk
              </Badge>
            </div>
            <p className="text-sm">{prediction.summary}</p>
            <div className="space-y-3">
              {Object.entries(
                (prediction.classes ?? []).reduce((acc: Record<string, any[]>, c: any) => {
                  (acc[c.date] ||= []).push(c); return acc;
                }, {})
              ).map(([date, items]) => (
                <div key={date} className="rounded-lg bg-background border overflow-hidden">
                  <div className="px-3 py-2 bg-muted/50 text-xs font-semibold flex justify-between">
                    <span>{(items as any[])[0].day}</span>
                    <span className="text-muted-foreground">{date}</span>
                  </div>
                  <div className="divide-y">
                    {(items as any[]).map((c, i) => (
                      <div key={i} className="px-3 py-2 flex items-center gap-3 text-sm">
                        <div className="text-xs text-muted-foreground w-24 shrink-0">{c.start?.slice(0,5)}–{c.end?.slice(0,5)}</div>
                        <div className="font-display font-semibold w-20 shrink-0">{c.code}</div>
                        <div className="flex-1 text-xs text-muted-foreground truncate">{c.reason}</div>
                        <Badge className={c.prediction === "present" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                          {c.prediction} · {Math.round((c.confidence ?? 0) * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
              {rows.slice(0, 30).map(r => (
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
