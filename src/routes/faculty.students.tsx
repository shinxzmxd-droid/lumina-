import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Plus, Trash2, Users, Upload, Pencil } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { facultyApproveStudent, listMyStudents, bulkAddStudentsByName } from "@/server/faculty-students.functions";
import { useServerFn } from "@tanstack/react-start";
import { withAuthHeaders } from "@/lib/serverFnAuth";

export const Route = createFileRoute("/faculty/students")({
  component: () => <RequireAuth roles={["faculty"]}><Page /></RequireAuth>,
});

function Page() {
  const { user } = useAuth();
  const approveFn = withAuthHeaders(useServerFn(facultyApproveStudent));
  const listFn = withAuthHeaders(useServerFn(listMyStudents));
  const [students, setStudents] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [members, setMembers] = useState<Record<string, any[]>>({});
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupSem, setNewGroupSem] = useState("3rd Semester");

  const loadStudents = async () => {
    try { const r = await listFn(); setStudents(r.students); } catch (e: any) { toast.error(e.message); }
  };
  const loadGroups = async () => {
    if (!user) return;
    const { data } = await supabase.from("class_groups").select("*").eq("faculty_id", user.id).order("created_at", { ascending: false });
    setGroups(data ?? []);
    const ids = (data ?? []).map((g: any) => g.id);
    if (ids.length) {
      const { data: m } = await supabase.from("class_group_members")
        .select("id, class_group_id, student_id")
        .in("class_group_id", ids);
      const byGroup: Record<string, any[]> = {};
      for (const row of (m ?? [])) (byGroup[row.class_group_id] ||= []).push(row);
      setMembers(byGroup);
    } else setMembers({});
  };

  useEffect(() => { if (user) { loadStudents(); loadGroups(); } }, [user]);

  const setApproval = async (sid: string, approved: boolean) => {
    try { await approveFn({ data: { studentId: sid, approved } }); toast.success(approved ? "Approved" : "Revoked"); loadStudents(); }
    catch (e: any) { toast.error(e.message); }
  };

  const createGroup = async () => {
    if (!newGroupName) return toast.error("Name required");
    const { error } = await supabase.from("class_groups").insert({
      name: newGroupName, semester: newGroupSem, faculty_id: user!.id,
    });
    if (error) return toast.error(error.message);
    setNewGroupName(""); toast.success("Class created"); loadGroups();
  };

  const addMember = async (groupId: string, studentId: string) => {
    const { error } = await supabase.from("class_group_members").insert({ class_group_id: groupId, student_id: studentId });
    if (error) return toast.error(error.message);
    loadGroups();
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from("class_group_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadGroups();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Delete this class?")) return;
    const { error } = await supabase.from("class_groups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadGroups();
  };

  const editGroup = async (g: any) => {
    const name = prompt("Class name", g.name)?.trim();
    if (!name) return;
    const sem = prompt("Semester (e.g. 3rd Semester)", g.semester)?.trim() || g.semester;
    const { error } = await supabase.from("class_groups").update({ name, semester: sem }).eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("Class updated"); loadGroups();
  };

  const pending = students.filter(s => !s.approved);
  const approved = students.filter(s => s.approved);

  const studentName = (sid: string) => students.find(s => s.user_id === sid)?.full_name ?? "Student";

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const extractNames = async (file: File): Promise<string[]> => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (["xlsx","xls","ods","xlsm","xlsb"].includes(ext)) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const out: string[] = [];
      for (const name of wb.SheetNames) {
        const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false });
        for (const row of rows) for (const cell of row) if (cell != null) out.push(String(cell));
      }
      return out;
    }
    const text = await file.text();
    if (ext === "json") {
      try {
        const data = JSON.parse(text);
        const out: string[] = [];
        const walk = (v: any) => {
          if (v == null) return;
          if (typeof v === "string" || typeof v === "number") out.push(String(v));
          else if (Array.isArray(v)) v.forEach(walk);
          else if (typeof v === "object") Object.values(v).forEach(walk);
        };
        walk(data);
        return out;
      } catch { /* fall through */ }
    }
    // csv / tsv / txt / md / anything text
    return text.split(/\r?\n/).flatMap(line => line.split(/[,\t;|]/));
  };

  const importNames = async (groupId: string, file: File) => {
    try {
      const raw = await extractNames(file);
      const cleaned = Array.from(new Set(
        raw.map(s => String(s).trim()).filter(s => s && s.length >= 2 && /[a-zA-Z]/.test(s))
      ));
      if (!cleaned.length) return toast.error("No names found in file");

      const existingIds = new Set((members[groupId] ?? []).map((m: any) => m.student_id));
      const matched: { id: string; name: string }[] = [];
      const unmatched: string[] = [];
      for (const n of cleaned) {
        const nn = norm(n);
        const hit = students.find(s => {
          const sn = norm(s.full_name ?? "");
          return sn && (sn === nn || sn.includes(nn) || nn.includes(sn));
        });
        if (hit && !existingIds.has(hit.user_id) && !matched.some(m => m.id === hit.user_id)) {
          matched.push({ id: hit.user_id, name: hit.full_name });
        } else if (!hit) {
          unmatched.push(n);
        }
      }

      if (matched.length) {
        const rows = matched.map(m => ({ class_group_id: groupId, student_id: m.id }));
        const { error } = await supabase.from("class_group_members").insert(rows);
        if (error) return toast.error(error.message);
      }
      toast.success(`${matched.length} added · ${unmatched.length} unmatched`);
      if (unmatched.length) console.warn("Unmatched names:", unmatched);
      loadGroups();
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    }
  };


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">My students & classes</h1>

      <Tabs defaultValue="approvals">
        <TabsList>
          <TabsTrigger value="approvals">Approvals ({pending.length})</TabsTrigger>
          <TabsTrigger value="classes">Classes ({groups.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="space-y-3 pt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Pending</h3>
            {pending.length === 0 ? <p className="text-sm text-muted-foreground">No pending students.</p> : (
              <div className="space-y-2">
                {pending.map(s => (
                  <div key={s.user_id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <div className="font-medium">{s.full_name}</div>
                      <div className="text-xs text-muted-foreground">Requested {new Date(s.created_at).toLocaleDateString()}</div>
                    </div>
                    <Button size="sm" onClick={() => setApproval(s.user_id, true)} className="bg-gradient-primary">
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Approved</h3>
            {approved.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
              <div className="space-y-2">
                {approved.map(s => (
                  <div key={s.user_id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="font-medium">{s.full_name}</div>
                    <Button size="sm" variant="outline" onClick={() => setApproval(s.user_id, false)}>
                      <X className="w-4 h-4 mr-1" /> Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="classes" className="space-y-4 pt-4">
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> New class</h3>
            <div className="grid sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2"><Label>Class name</Label><Input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="CSE-A" /></div>
              <div>
                <Label>Semester</Label>
                <Select value={newGroupSem} onValueChange={setNewGroupSem}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["1st Semester","2nd Semester","3rd Semester","4th Semester","5th Semester","6th Semester","7th Semester","8th Semester"].map(s=>(
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={createGroup} className="bg-gradient-primary"><Plus className="w-4 h-4 mr-2" />Create class</Button>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            {groups.map(g => {
              const ms = members[g.id] ?? [];
              const memberIds = new Set(ms.map((m: any) => m.student_id));
              const eligible = approved.filter(s => !memberIds.has(s.user_id));
              return (
                <Card key={g.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-display font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> {g.name}</h4>
                      <Badge variant="outline" className="mt-1">{g.semester}</Badge>
                    </div>
                    <Button size="icon" variant="ghost" onClick={()=>editGroup(g)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={()=>deleteGroup(g.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  <div className="space-y-1">
                    {ms.length === 0 ? <p className="text-xs text-muted-foreground">No students yet.</p> : ms.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between text-sm border-b py-1.5 last:border-0">
                        <span>{studentName(m.student_id)}</span>
                        <Button size="sm" variant="ghost" onClick={()=>removeMember(m.id)}><X className="w-3 h-3" /></Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild><Button size="sm" variant="outline" className="flex-1"><Plus className="w-3 h-3 mr-1" />Add student</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Add to {g.name}</DialogTitle></DialogHeader>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {eligible.length === 0 && <p className="text-sm text-muted-foreground">No approved students available.</p>}
                          {eligible.map(s => (
                            <Button key={s.user_id} variant="outline" className="w-full justify-start" onClick={()=>addMember(g.id, s.user_id)}>
                              + {s.full_name}
                            </Button>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button asChild size="sm" variant="outline" className="flex-1 cursor-pointer">
                      <label>
                        <Upload className="w-3 h-3 mr-1" /> Import file
                        <input
                          type="file"
                          className="hidden"
                          accept=".csv,.tsv,.txt,.md,.json,.xlsx,.xls,.xlsm,.xlsb,.ods,text/*"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            e.currentTarget.value = "";
                            if (f) await importNames(g.id, f);
                          }}
                        />
                      </label>
                    </Button>
                  </div>
                </Card>
              );
            })}
            {groups.length === 0 && <p className="text-muted-foreground col-span-full text-center py-6 text-sm">No classes yet.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
