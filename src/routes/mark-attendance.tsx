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
import { CheckCircle2, XCircle } from "lucide-react";
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
      const { data: enr } = await supabase.from("enrollments").select("student_id, profiles!inner(full_name, user_id)").eq("course_id", courseId);
      // profiles join via user_id; fallback fetch
      const ids = (enr ?? []).map((e: any) => e.student_id);
      const { data: profs } = await supabase.from("profiles").select("*").in("user_id", ids);
      setStudents(profs ?? []);
      const init: Record<string, boolean> = {};
      ids.forEach((id: string) => init[id] = true);
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Mark attendance</h1>
      <Card className="p-5 flex items-center gap-4">
        <div className="flex-1 max-w-xs">
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
            <SelectContent>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">Session date: {date}</div>
        {courseId && <Button onClick={save} className="ml-auto bg-gradient-primary shadow-glow">Save attendance</Button>}
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
                  <thead className="bg-muted/50"><tr><th className="text-left p-3">Student</th><th className="text-right p-3">Present</th></tr></thead>
                  <tbody>
                    {students.length === 0 && <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">No students enrolled.</td></tr>}
                    {students.map(s => renderRow(s, present[s.user_id] ?? true))}
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
