import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Upload, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/mark-attendance")({
  component: () => <RequireAuth roles={["faculty","admin"]}><Page /></RequireAuth>,
});

function Page() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [date] = useState(new Date().toISOString().slice(0,10));

  useEffect(() => {
    supabase.from("courses").select("*").eq("faculty_id", user!.id).then(({data}) => setCourses(data ?? []));
  }, [user]);

  useEffect(() => {
    if (!courseId) return;
    (async () => {
      // Pull all students assigned to this faculty ("My Students")
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, approved, assigned_faculty_id")
        .eq("assigned_faculty_id", user!.id);
      const list = (profs ?? []).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
      setStudents(list);
      const init: Record<string, boolean> = {};
      list.forEach((s: any) => { init[s.user_id] = true; });
      setPresent(init);
    })();
  }, [courseId]);

  const save = async () => {
    if (!courseId) return;
    const rows = Object.entries(present).map(([sid, p]) => ({
      course_id: courseId, student_id: sid, session_date: date, present: p, marked_by: user!.id,
    }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "course_id,student_id,session_date" });
    if (error) return toast.error(error.message);
    toast.success(`Saved attendance for ${rows.length} students`);
  };

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const handleImport = async (file: File, mode: "present" | "absent") => {
    if (!students.length) return toast.error("Select a course with enrolled students first");
    const text = await file.text();
    const names = text.split(/\r?\n/).flatMap(l => l.split(",")).map(s => s.trim()).filter(Boolean);
    if (!names.length) return toast.error("No names found in file");
    const wanted = new Set(names.map(normalize));
    const next = { ...present };
    const matched: string[] = [];
    const unmatched: string[] = [];
    for (const s of students) {
      const n = normalize(s.full_name || "");
      if (wanted.has(n)) { next[s.user_id] = mode === "present"; matched.push(s.full_name); }
    }
    const matchedNorms = new Set(students.filter(s => wanted.has(normalize(s.full_name||""))).map(s => normalize(s.full_name||"")));
    for (const n of names) if (!matchedNorms.has(normalize(n))) unmatched.push(n);
    setPresent(next);
    toast.success(`Marked ${matched.length} as ${mode}${unmatched.length ? ` · ${unmatched.length} unmatched` : ""}`);
    if (unmatched.length) console.log("Unmatched names:", unmatched);
  };

  const downloadTemplate = () => {
    const csv = "full_name\n" + students.map(s => s.full_name).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "attendance-roster.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Mark attendance</h1>
      <Card className="p-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] max-w-xs">
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
            <SelectContent>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">Session date: {date}</div>
        {courseId && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={!students.length}>
              <Download className="w-4 h-4 mr-1" /> Template
            </Button>
            <label className="inline-flex">
              <input type="file" accept=".csv,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f, "present"); e.target.value = ""; }} />
              <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" /> Import present</span></Button>
            </label>
            <label className="inline-flex">
              <input type="file" accept=".csv,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f, "absent"); e.target.value = ""; }} />
              <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" /> Import absent</span></Button>
            </label>
            <Button onClick={save} className="bg-gradient-primary shadow-glow">Save attendance</Button>
          </div>
        )}
      </Card>

      {courseId && (() => {
        const presentList = students.filter(s => present[s.user_id] ?? true);
        const absentList = students.filter(s => !(present[s.user_id] ?? true));
        const renderRow = (s: any, isPresent: boolean) => (
          <tr key={s.user_id} className="border-t">
            <td className="p-3">{s.full_name}</td>
            <td className="p-3 text-right">
              <Switch checked={isPresent} onCheckedChange={(v)=>setPresent({...present, [s.user_id]: v})} />
            </td>
          </tr>
        );
        return (
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All <Badge variant="outline" className="ml-2">{students.length}</Badge></TabsTrigger>
              <TabsTrigger value="present"><CheckCircle2 className="w-3.5 h-3.5 mr-1 text-success" /> Present <Badge variant="outline" className="ml-2">{presentList.length}</Badge></TabsTrigger>
              <TabsTrigger value="absent"><XCircle className="w-3.5 h-3.5 mr-1 text-destructive" /> Absent <Badge variant="outline" className="ml-2">{absentList.length}</Badge></TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50"><tr><th className="text-left p-3">Student</th><th className="text-right p-3">Status</th></tr></thead>
                  <tbody>
                    {students.length === 0 && <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">No students enrolled.</td></tr>}
                    {students.map(s => {
                      const isPresent = present[s.user_id] ?? true;
                      return (
                        <tr key={s.user_id} className="border-t">
                          <td className="p-3">{s.full_name}</td>
                          <td className="p-3 text-right">
                            <div className="inline-flex rounded-md overflow-hidden border">
                              <button
                                type="button"
                                onClick={() => setPresent({ ...present, [s.user_id]: true })}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${isPresent ? "bg-success text-success-foreground" : "bg-background hover:bg-muted"}`}
                              >
                                Present
                              </button>
                              <button
                                type="button"
                                onClick={() => setPresent({ ...present, [s.user_id]: false })}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${!isPresent ? "bg-destructive text-destructive-foreground" : "bg-background hover:bg-muted"}`}
                              >
                                Absent
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </TabsContent>

            <TabsContent value="present">
              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50"><tr><th className="text-left p-3">Student</th><th className="text-right p-3">Mark absent</th></tr></thead>
                  <tbody>
                    {presentList.length === 0 && <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">No students marked present.</td></tr>}
                    {presentList.map(s => renderRow(s, true))}
                  </tbody>
                </table>
              </Card>
            </TabsContent>

            <TabsContent value="absent">
              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50"><tr><th className="text-left p-3">Student</th><th className="text-right p-3">Mark present</th></tr></thead>
                  <tbody>
                    {absentList.length === 0 && <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">No students marked absent.</td></tr>}
                    {absentList.map(s => renderRow(s, false))}
                  </tbody>
                </table>
              </Card>
            </TabsContent>
          </Tabs>
        );
      })()}
    </div>
  );
}
