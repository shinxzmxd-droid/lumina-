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
