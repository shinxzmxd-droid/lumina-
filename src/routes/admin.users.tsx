import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { adminCreateUser, adminSetApproval } from "@/server/admin-users.functions";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Check, X, UserPlus, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  component: () => <RequireAuth roles={["admin"]}><Page /></RequireAuth>,
});

function Page() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", role: "faculty" as "student"|"faculty"|"admin" });

  const load = async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);
    const map: Record<string,string[]> = {};
    (r ?? []).forEach((x: any) => { (map[x.user_id] ||= []).push(x.role); });
    setRoles(map);
    setProfiles(p ?? []);
  };
  useEffect(() => { load(); }, []);

  const setApproval = async (uid: string, approved: boolean) => {
    try {
      await adminSetApproval({ data: { userId: uid, approved } });
      toast.success(approved ? "Approved" : "Revoked");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const create = async () => {
    setBusy(true);
    try {
      await adminCreateUser({ data: form });
      toast.success("Account created");
      setOpen(false);
      setForm({ email: "", password: "", fullName: "", role: "faculty" });
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const isStudent = (uid: string) => (roles[uid] ?? []).includes("student");
  const pending = profiles.filter(p => !p.approved && !isStudent(p.user_id));
  const studentsPending = profiles.filter(p => !p.approved && isStudent(p.user_id));
  const approved = profiles.filter(p => p.approved);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold font-display">Users & approvals</h1>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary"><Plus className="w-4 h-4 mr-2" />Create account</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create new account</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full name</Label><Input value={form.fullName} onChange={e=>setForm({...form, fullName: e.target.value})} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} /></div>
              <div><Label>Password (min 8 chars)</Label><Input type="text" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} /></div>
              <div>
                <Label className="mb-2 block">Role</Label>
                <RadioGroup value={form.role} onValueChange={(v)=>setForm({...form, role: v as any})} className="grid grid-cols-3 gap-2">
                  {(["student","faculty","admin"] as const).map(r=>(
                    <Label key={r} className={`border rounded-lg p-2 text-center cursor-pointer capitalize text-sm ${form.role===r?"border-primary bg-primary/5":""}`}>
                      <RadioGroupItem value={r} className="sr-only" />{r}
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              <Button className="w-full" disabled={busy || !form.email || !form.password || !form.fullName} onClick={create}>
                {busy ? "Creating…" : "Create & auto-approve"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending faculty/admin ({pending.length})</TabsTrigger>
          <TabsTrigger value="students-pending">Students awaiting faculty ({studentsPending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <UserTable rows={pending} roles={roles} onApprove={(uid: string)=>setApproval(uid, true)} pending />
        </TabsContent>
        <TabsContent value="students-pending">
          <Card className="p-3 mb-3 text-xs text-muted-foreground">
            Student approvals are handled by their assigned faculty. Listed here for visibility only.
          </Card>
          <UserTable rows={studentsPending} roles={roles} onApprove={(uid: string)=>setApproval(uid, true)} pending />
        </TabsContent>
        <TabsContent value="approved">
          <UserTable rows={approved} roles={roles} onRevoke={(uid: string)=>setApproval(uid, false)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserTable({ rows, roles, onApprove, onRevoke, pending }: any) {
  if (!rows.length) return <Card className="p-6 text-sm text-muted-foreground text-center">No users.</Card>;
  return (
    <Card className="p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">Roles</th>
            <th className="text-left p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p: any) => (
            <tr key={p.user_id} className="border-t">
              <td className="p-3">{p.full_name || "—"}</td>
              <td className="p-3 space-x-1">
                {(roles[p.user_id] ?? []).map((r: string) => <Badge key={r} variant="outline" className="capitalize">{r}</Badge>)}
              </td>
              <td className="p-3">
                {pending ? (
                  <Button size="sm" onClick={()=>onApprove(p.user_id)} className="bg-gradient-primary">
                    <Check className="w-4 h-4 mr-1" />Approve
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={()=>onRevoke(p.user_id)}>
                    <X className="w-4 h-4 mr-1" />Revoke
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
