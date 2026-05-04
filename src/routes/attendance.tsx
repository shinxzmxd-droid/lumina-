import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/attendance")({
  component: () => <RequireAuth roles={["student"]}><Page /></RequireAuth>,
});

function Page() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("attendance").select("*, courses(name, code)").eq("student_id", user.id).order("session_date", { ascending: false }).then(({ data }) => setRows(data ?? []));
  }, [user]);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">My attendance</h1>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr><th className="text-left p-3">Date</th><th className="text-left p-3">Course</th><th className="text-left p-3">Status</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No records yet.</td></tr>}
            {rows.map(r => (
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
  );
}
