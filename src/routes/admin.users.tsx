import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  component: () => <RequireAuth roles={["admin"]}><Page /></RequireAuth>,
});

const ROLES = ["faculty","admin"] as const;

function Page() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});

  const load = async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
    ]);
    const map: Record<string,string[]> = {};
    (r ?? []).forEach((x: any) => { (map[x.user_id] ||= []).push(x.role); });
    setRoles(map);
    // Show only faculty + admin (hide students)
    const facultyOnly = (p ?? []).filter(pr => {
      const userRoles = map[pr.user_id] ?? [];
      return userRoles.includes("faculty") || userRoles.includes("admin");
    });
    setProfiles(facultyOnly);
  };
  useEffect(() => { load(); }, []);

  const setRole = async (uid: string, role: string) => {
    await supabase.from("user_roles").delete().eq("user_id", uid);
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: role as any });
    if (error) return toast.error(error.message);
    toast.success("Role updated"); load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Faculty & roles</h1>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="text-left p-3">Name</th><th className="text-left p-3">Current roles</th><th className="text-left p-3">Set role</th></tr></thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.user_id} className="border-t">
                <td className="p-3">{p.full_name || "—"}</td>
                <td className="p-3 space-x-1">
                  {(roles[p.user_id] ?? []).map(r => <Badge key={r} variant="outline" className="capitalize">{r}</Badge>)}
                </td>
                <td className="p-3 space-x-1">
                  {ROLES.map(r => (
                    <Button key={r} size="sm" variant="outline" className="capitalize" onClick={()=>setRole(p.user_id, r)}>{r}</Button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
