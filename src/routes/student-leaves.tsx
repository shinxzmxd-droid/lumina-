import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/student-leaves")({
  component: () => <RequireAuth roles={["student"]}><Page /></RequireAuth>,
});

function Page() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [reason, setReason] = useState("");

  const load = () => supabase.from("student_leaves").select("*").eq("student_id", user!.id).order("created_at",{ascending:false}).then(({data})=>setRows(data ?? []));
  useEffect(() => { if (user) load(); }, [user]);

  const submit = async () => {
    if (!start || !end || !reason) return toast.error("Fill all fields");
    const { error } = await supabase.from("student_leaves").insert({ student_id: user!.id, start_date: start, end_date: end, reason });
    if (error) return toast.error(error.message);
    toast.success("Leave request submitted — waiting for faculty approval");
    setStart(""); setEnd(""); setReason(""); load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">My leave requests</h1>
      <Card className="p-5">
        <h3 className="font-display font-semibold mb-3">Apply for leave</h3>
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <div><Label>Start date</Label><Input type="date" value={start} onChange={e=>setStart(e.target.value)} /></div>
          <div><Label>End date</Label><Input type="date" value={end} onChange={e=>setEnd(e.target.value)} /></div>
        </div>
        <div className="mb-3"><Label>Reason</Label><Textarea value={reason} onChange={e=>setReason(e.target.value)} /></div>
        <Button onClick={submit} className="bg-gradient-primary">Submit request</Button>
      </Card>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="text-left p-3">Dates</th><th className="text-left p-3">Reason</th><th className="text-left p-3">Status</th></tr></thead>
          <tbody>
            {rows.length===0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No leave requests yet.</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.start_date} → {r.end_date}</td>
                <td className="p-3">{r.reason}</td>
                <td className="p-3">
                  {r.status === "approved" ? <Badge className="bg-success text-success-foreground">Approved</Badge>
                   : r.status === "rejected" ? <Badge variant="destructive">Rejected</Badge>
                   : <Badge variant="secondary">Pending</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
