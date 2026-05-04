import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/faculty-leaves")({
  component: () => <RequireAuth roles={["faculty","admin"]}><Page /></RequireAuth>,
});

function Page() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from("student_leaves").select("*").order("created_at",{ascending:false});
    const ids = Array.from(new Set((data ?? []).map(r => r.student_id)));
    const { data: profs } = ids.length ? await supabase.from("profiles").select("user_id, full_name").in("user_id", ids) : { data: [] };
    const map = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
    setRows((data ?? []).map(r => ({ ...r, _name: map[r.student_id] ?? "Student" })));
  };
  useEffect(() => { load(); }, []);

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("student_leaves").update({ status, reviewed_by: user!.id }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Leave ${status}`); load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Student leave requests</h1>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="text-left p-3">Student</th><th className="text-left p-3">Dates</th><th className="text-left p-3">Reason</th><th className="text-left p-3">Status</th><th></th></tr></thead>
          <tbody>
            {rows.length===0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No requests.</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r._name}</td>
                <td className="p-3">{r.start_date} → {r.end_date}</td>
                <td className="p-3">{r.reason}</td>
                <td className="p-3">
                  {r.status === "approved" ? <Badge className="bg-success text-success-foreground">Approved</Badge>
                   : r.status === "rejected" ? <Badge variant="destructive">Rejected</Badge>
                   : <Badge variant="secondary">Pending</Badge>}
                </td>
                <td className="p-3 text-right space-x-2">
                  {r.status === "pending" && <>
                    <Button size="sm" onClick={()=>decide(r.id,"approved")} className="bg-success text-success-foreground">Approve</Button>
                    <Button size="sm" variant="destructive" onClick={()=>decide(r.id,"rejected")}>Reject</Button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
