import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";

export const Route = createFileRoute("/results")({
  component: () => <RequireAuth roles={["student"]}><Page /></RequireAuth>,
});

function Page() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("results")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });
      setRows(data ?? []);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Award className="w-7 h-7 text-primary" />
        <h1 className="text-3xl font-bold font-display">My Results</h1>
      </div>
      {rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No results published yet.</Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {rows.map(r => {
            const pct = r.max_marks ? Math.round((Number(r.marks_obtained) / Number(r.max_marks)) * 100) : 0;
            return (
              <Card key={r.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display font-semibold text-lg">{r.exam_name}</div>
                    {r.semester && <div className="text-xs text-muted-foreground">{r.semester}</div>}
                  </div>
                  {r.grade && <Badge className="bg-gradient-primary">{r.grade}</Badge>}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{r.marks_obtained}</span>
                  <span className="text-sm text-muted-foreground">/ {r.max_marks}</span>
                  <span className="ml-auto text-sm font-medium">{pct}%</span>
                </div>
                {r.remarks && <p className="text-sm text-muted-foreground">{r.remarks}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
