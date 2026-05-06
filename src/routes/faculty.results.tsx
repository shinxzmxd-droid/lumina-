import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Award, Upload, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/faculty/results")({
  component: () => <RequireAuth roles={["faculty"]}><Page /></RequireAuth>,
});

function Page() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [groupId, setGroupId] = useState<string>("");
  const [results, setResults] = useState<any[]>([]);
  const [form, setForm] = useState({ studentId: "", examName: "", marks: "", max: "100", grade: "", remarks: "", semester: "" });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: gs } = await supabase.from("class_groups").select("*").eq("faculty_id", user.id).order("created_at");
      setGroups(gs ?? []);
      if (gs?.[0]) setGroupId(gs[0].id);
    })();
  }, [user]);

  useEffect(() => {
    if (!groupId) return;
    (async () => {
      const { data: ms } = await supabase.from("class_group_members").select("student_id").eq("class_group_id", groupId);
      const ids = (ms ?? []).map((m: any) => m.student_id);
      setMembers(ids);
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
        const map: Record<string, string> = {};
        (ps ?? []).forEach((p: any) => { map[p.user_id] = p.full_name; });
        setProfiles(map);
        const { data: rs } = await supabase.from("results").select("*").in("student_id", ids).order("created_at", { ascending: false });
        setResults(rs ?? []);
      } else { setProfiles({}); setResults([]); }
    })();
  }, [groupId]);

  const addOne = async () => {
    if (!form.studentId || !form.examName) return toast.error("Student and exam name required");
    const { error } = await supabase.from("results").insert({
      student_id: form.studentId,
      exam_name: form.examName,
      marks_obtained: Number(form.marks) || 0,
      max_marks: Number(form.max) || 100,
      grade: form.grade || null,
      remarks: form.remarks || null,
      semester: form.semester || null,
      created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Result added");
    setForm({ ...form, studentId: "", marks: "", grade: "", remarks: "" });
    const { data: rs } = await supabase.from("results").select("*").in("student_id", members).order("created_at", { ascending: false });
    setResults(rs ?? []);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this result?")) return;
    const { error } = await supabase.from("results").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setResults(results.filter(r => r.id !== id));
  };

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const importFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (!rows.length) return toast.error("Empty sheet");

      const findKey = (row: any, names: string[]) => {
        const keys = Object.keys(row);
        for (const n of names) {
          const k = keys.find(k => norm(k) === norm(n) || norm(k).includes(norm(n)));
          if (k) return k;
        }
        return null;
      };

      const sample = rows[0];
      const nameKey = findKey(sample, ["name", "student", "student name", "full name"]);
      const examKey = findKey(sample, ["exam", "exam name", "test", "assessment"]);
      const marksKey = findKey(sample, ["marks", "score", "marks obtained", "obtained"]);
      const maxKey = findKey(sample, ["max", "max marks", "total", "out of"]);
      const gradeKey = findKey(sample, ["grade"]);
      const remarksKey = findKey(sample, ["remarks", "comment", "comments"]);
      const semKey = findKey(sample, ["semester", "sem"]);

      if (!nameKey || !marksKey) return toast.error("Sheet must have Name and Marks columns");

      let added = 0; const unmatched: string[] = [];
      const inserts: any[] = [];
      for (const row of rows) {
        const nm = String(row[nameKey] ?? "").trim();
        if (!nm) continue;
        const sid = members.find(id => {
          const fn = norm(profiles[id] ?? "");
          const tn = norm(nm);
          return fn && (fn === tn || fn.includes(tn) || tn.includes(fn));
        });
        if (!sid) { unmatched.push(nm); continue; }
        inserts.push({
          student_id: sid,
          exam_name: String(row[examKey ?? ""] ?? form.examName ?? "Exam") || "Exam",
          marks_obtained: Number(row[marksKey]) || 0,
          max_marks: Number(row[maxKey ?? ""]) || 100,
          grade: gradeKey ? String(row[gradeKey] ?? "") || null : null,
          remarks: remarksKey ? String(row[remarksKey] ?? "") || null : null,
          semester: semKey ? String(row[semKey] ?? "") || null : (form.semester || null),
          created_by: user!.id,
        });
        added++;
      }
      if (!inserts.length) return toast.error("No matching students in this class");
      const { error } = await supabase.from("results").insert(inserts);
      if (error) return toast.error(error.message);
      toast.success(`${added} results added · ${unmatched.length} unmatched`);
      if (unmatched.length) console.warn("Unmatched:", unmatched);
      const { data: rs } = await supabase.from("results").select("*").in("student_id", members).order("created_at", { ascending: false });
      setResults(rs ?? []);
    } catch (e: any) { toast.error(e.message ?? "Import failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Award className="w-7 h-7 text-primary" />
        <h1 className="text-3xl font-bold font-display">Student Results</h1>
      </div>

      <Card className="p-4 space-y-3">
        <Label>Class</Label>
        <Select value={groupId} onValueChange={setGroupId}>
          <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
          <SelectContent>
            {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name} • {g.semester}</SelectItem>)}
          </SelectContent>
        </Select>
        {groups.length === 0 && <p className="text-sm text-muted-foreground">Create a class first under My Students.</p>}
      </Card>

      {groupId && (
        <Tabs defaultValue="manual">
          <TabsList>
            <TabsTrigger value="manual">Manual entry</TabsTrigger>
            <TabsTrigger value="upload">Upload file</TabsTrigger>
            <TabsTrigger value="all">All results ({results.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="pt-4">
            <Card className="p-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Student</Label>
                  <Select value={form.studentId} onValueChange={(v) => setForm({ ...form, studentId: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick student" /></SelectTrigger>
                    <SelectContent>
                      {members.map(id => <SelectItem key={id} value={id}>{profiles[id] ?? "Student"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Exam name</Label><Input value={form.examName} onChange={e => setForm({ ...form, examName: e.target.value })} placeholder="Mid-term" /></div>
                <div><Label>Marks obtained</Label><Input type="number" value={form.marks} onChange={e => setForm({ ...form, marks: e.target.value })} /></div>
                <div><Label>Max marks</Label><Input type="number" value={form.max} onChange={e => setForm({ ...form, max: e.target.value })} /></div>
                <div><Label>Grade (optional)</Label><Input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} placeholder="A+" /></div>
                <div><Label>Semester (optional)</Label><Input value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} placeholder="3rd Semester" /></div>
                <div className="sm:col-span-2"><Label>Remarks</Label><Input value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} /></div>
              </div>
              <Button onClick={addOne} className="bg-gradient-primary"><Plus className="w-4 h-4 mr-2" />Add result</Button>
            </Card>
          </TabsContent>

          <TabsContent value="upload" className="pt-4">
            <Card className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload a CSV/XLSX with columns: <strong>Name, Exam, Marks, Max, Grade, Remarks, Semester</strong>.
                Names are matched against students in the selected class.
              </p>
              <Button asChild className="bg-gradient-primary cursor-pointer">
                <label>
                  <Upload className="w-4 h-4 mr-2" /> Choose file
                  <input type="file" className="hidden" accept=".csv,.tsv,.xlsx,.xls,.ods"
                    onChange={async e => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) await importFile(f); }} />
                </label>
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="pt-4 space-y-2">
            {results.length === 0 ? <p className="text-muted-foreground text-sm">No results yet.</p> : results.map(r => (
              <Card key={r.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{profiles[r.student_id] ?? "Student"} — {r.exam_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.marks_obtained}/{r.max_marks} {r.grade && `• ${r.grade}`} {r.semester && `• ${r.semester}`}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></Button>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
