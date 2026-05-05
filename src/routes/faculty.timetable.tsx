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
import { Calendar, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/faculty/timetable")({
  component: () => <RequireAuth roles={["faculty"]}><Page /></RequireAuth>,
});

const DAYS = [
  { n: 1, label: "Monday" }, { n: 2, label: "Tuesday" }, { n: 3, label: "Wednesday" },
  { n: 4, label: "Thursday" }, { n: 5, label: "Friday" }, { n: 6, label: "Saturday" },
];

function Page() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [form, setForm] = useState({ course_id: "", day_of_week: 1, start_time: "09:00", end_time: "10:00", room: "R-101" });

  const load = async () => {
    if (!user) return;
    const { data: cs } = await supabase.from("courses").select("*").eq("faculty_id", user.id);
    setCourses(cs ?? []);
    const ids = (cs ?? []).map((c: any) => c.id);
    if (ids.length) {
      const { data: ts } = await supabase.from("timetable_slots")
        .select("*, courses(code, name)").in("course_id", ids).order("day_of_week").order("start_time");
      setSlots(ts ?? []);
    } else setSlots([]);
  };
  useEffect(() => { load(); }, [user]);

  const add = async () => {
    if (!form.course_id) return toast.error("Pick a course");
    if (form.start_time >= form.end_time) return toast.error("End time must be after start time");

    // Check overlap with this faculty's other slots (across all classes)
    const courseIds = courses.map(c => c.id);
    const { data: existing } = await supabase.from("timetable_slots")
      .select("start_time, end_time")
      .in("course_id", courseIds)
      .eq("day_of_week", form.day_of_week);
    const conflict = (existing ?? []).some((es: any) => {
      const s = es.start_time.slice(0,5), e = es.end_time.slice(0,5);
      return form.start_time < e && s < form.end_time;
    });
    if (conflict) return toast.error("You already have a class in that time slot");

    const { error } = await supabase.from("timetable_slots").insert({
      course_id: form.course_id,
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time,
      room: form.room || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Slot added"); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this slot?")) return;
    const { error } = await supabase.from("timetable_slots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display flex items-center gap-2">
          <Calendar className="w-7 h-7 text-accent" /> Edit My Timetable
        </h1>
        <p className="text-muted-foreground text-sm">Add slots for the courses you teach. Students see them in their Timetable view.</p>
      </div>

      {courses.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          You don't own any courses yet. Create one in <strong>My Courses</strong> first.
        </Card>
      ) : (
        <Card className="p-5 space-y-3">
          <h3 className="font-semibold">Add slot</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <div className="lg:col-span-2">
              <Label>Course</Label>
              <Select value={form.course_id} onValueChange={(v)=>setForm({...form, course_id: v})}>
                <SelectTrigger><SelectValue placeholder="Pick course" /></SelectTrigger>
                <SelectContent>
                  {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Day</Label>
              <Select value={String(form.day_of_week)} onValueChange={(v)=>setForm({...form, day_of_week: +v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map(d => <SelectItem key={d.n} value={String(d.n)}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={e=>setForm({...form, start_time: e.target.value})} /></div>
            <div><Label>End</Label><Input type="time" value={form.end_time} onChange={e=>setForm({...form, end_time: e.target.value})} /></div>
            <div className="sm:col-span-2 lg:col-span-1"><Label>Room</Label><Input value={form.room} onChange={e=>setForm({...form, room: e.target.value})} /></div>
          </div>
          <Button onClick={add} className="bg-gradient-primary"><Plus className="w-4 h-4 mr-2" />Add slot</Button>
        </Card>
      )}

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-muted/60">
            <tr>
              <th className="text-left p-3">Day</th>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Course</th>
              <th className="text-left p-3">Room</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {slots.map(s => (
              <tr key={s.id} className="border-t">
                <td className="p-3">{DAYS.find(d => d.n === s.day_of_week)?.label}</td>
                <td className="p-3">{s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}</td>
                <td className="p-3">{s.courses?.code} {s.courses?.name}</td>
                <td className="p-3">{s.room ?? "—"}</td>
                <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={()=>remove(s.id)}><Trash2 className="w-4 h-4" /></Button></td>
              </tr>
            ))}
            {slots.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No slots yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
