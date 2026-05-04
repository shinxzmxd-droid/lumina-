import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/admin/courses")({
  component: () => <RequireAuth roles={["admin"]}><Page /></RequireAuth>,
});

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(()=>{ supabase.from("courses").select("*").then(({data})=>setRows(data ?? [])); },[]);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">All courses</h1>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="text-left p-3">Code</th><th className="text-left p-3">Name</th></tr></thead>
          <tbody>
            {rows.length===0 && <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">No courses yet.</td></tr>}
            {rows.map(c=>(
              <tr key={c.id} className="border-t"><td className="p-3 font-mono">{c.code}</td><td className="p-3">{c.name}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
