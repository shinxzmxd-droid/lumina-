import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Trash2, Plus } from "lucide-react";
import { generateTimetable } from "@/server/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/timetable")({
  component: () => <RequireAuth roles={["admin"]}><Page /></RequireAuth>,
});

const DAY_MAP: Record<string, number> = { Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };

function Page() {
  const gen = useServerFn(generateTimetable);
  const [faculty, setFaculty] = useState([{ name: "Dr. Patel", subjects: "Algorithms, Data Structures", weeklyHours: 12 }]);
  const [duration, setDuration] = useState(60);
  const [days, setDays] = useState(5);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);

  const updateF = (i: number, k: string, v: any) => {
    const next = [...faculty]; (next[i] as any)[k] = v; setFaculty(next);
  };

  const generate = async () => {
    setBusy(true); setPreview([]);
    try {
      const res = await gen({ data: {
        faculty: faculty.map(f => ({ name: f.name, subjects: f.subjects.split(",").map(s=>s.trim()).filter(Boolean), weeklyHours: Number(f.weeklyHours) })),
        classDurationMins: Number(duration),
        workingDays: Number(days),
        startHour: Number(startHour),
        endHour: Number(endHour),
      }});
      if ((res as any).ok === false) {
        toast.error("AI returned invalid format. Try again.");
      } else {
        setPreview((res as any).slots ?? []);
        toast.success(`Generated ${((res as any).slots ?? []).length} slots`);
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const persist = async () => {
    // ensure courses exist (one per subject); then insert slots
    const { data: existing } = await supabase.from("courses").select("*");
    const byName: Record<string,string> = {};
    (existing ?? []).forEach((c: any) => { byName[c.name.toLowerCase()] = c.id; });

    const inserts: any[] = [];
    for (const s of preview) {
      let cid = byName[s.subject?.toLowerCase()];
      if (!cid) {
        const code = s.subject.split(" ").map((w:string)=>w[0]).join("").toUpperCase().slice(0,4) + Math.floor(100+Math.random()*900);
        const { data: nc } = await supabase.from("courses").insert({ name: s.subject, code }).select().single();
        if (nc) { cid = nc.id; byName[s.subject.toLowerCase()] = cid; }
      }
      if (cid) inserts.push({
        course_id: cid,
        day_of_week: DAY_MAP[s.day] ?? 1,
        start_time: s.start, end_time: s.end, room: s.room ?? "R-101",
      });
    }
    await supabase.from("timetable_slots").delete().neq("id","00000000-0000-0000-0000-000000000000");
    const { error } = await supabase.from("timetable_slots").insert(inserts);
    if (error) return toast.error(error.message);
    toast.success("Timetable saved & live across the campus");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-2"><Sparkles className="w-7 h-7 text-accent" /> AI Timetable Generator</h1>
          <p className="text-muted-foreground">Conflict-free schedules in seconds.</p>
        </div>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid md:grid-cols-4 gap-3">
          <div><Label>Class duration (min)</Label><Input type="number" value={duration} onChange={e=>setDuration(+e.target.value)} /></div>
          <div><Label>Working days/week</Label><Input type="number" value={days} onChange={e=>setDays(+e.target.value)} /></div>
          <div><Label>Day starts (hr)</Label><Input type="number" value={startHour} onChange={e=>setStartHour(+e.target.value)} /></div>
          <div><Label>Day ends (hr)</Label><Input type="number" value={endHour} onChange={e=>setEndHour(+e.target.value)} /></div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Faculty</Label>
            <Button size="sm" variant="outline" onClick={()=>setFaculty([...faculty,{name:"",subjects:"",weeklyHours:8}])}><Plus className="w-3 h-3 mr-1"/>Add</Button>
          </div>
          <div className="space-y-2">
            {faculty.map((f,i)=>(
              <div key={i} className="grid md:grid-cols-[2fr_3fr_1fr_auto] gap-2">
                <Input placeholder="Name" value={f.name} onChange={e=>updateF(i,"name",e.target.value)} />
                <Input placeholder="Subjects (comma separated)" value={f.subjects} onChange={e=>updateF(i,"subjects",e.target.value)} />
                <Input type="number" placeholder="hrs/wk" value={f.weeklyHours} onChange={e=>updateF(i,"weeklyHours",+e.target.value)} />
                <Button size="icon" variant="ghost" onClick={()=>setFaculty(faculty.filter((_,j)=>j!==i))}><Trash2 className="w-4 h-4"/></Button>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={generate} disabled={busy} className="bg-gradient-primary shadow-glow">
          {busy ? "Generating…" : <><Sparkles className="w-4 h-4 mr-2"/>Generate timetable</>}
        </Button>
      </Card>

      {preview.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold">Preview ({preview.length} slots)</h3>
            <Button onClick={persist} className="bg-gradient-accent text-accent-foreground">Save & publish</Button>
          </div>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="text-left p-2">Day</th><th className="text-left p-2">Time</th><th className="text-left p-2">Subject</th><th className="text-left p-2">Faculty</th><th className="text-left p-2">Room</th></tr></thead>
              <tbody>
                {preview.map((s,i)=>(
                  <tr key={i} className="border-t"><td className="p-2">{s.day}</td><td className="p-2">{s.start} – {s.end}</td><td className="p-2">{s.subject}</td><td className="p-2">{s.faculty}</td><td className="p-2">{s.room}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
