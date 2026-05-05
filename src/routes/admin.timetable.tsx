import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Users, GraduationCap } from "lucide-react";
import { generateTimetable } from "@/server/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/timetable")({
  component: () => <RequireAuth roles={["admin"]}><Page /></RequireAuth>,
});

const DAY_MAP: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const DAYS = [
  { n: 1, label: "MONDAY", short: "Mon" },
  { n: 2, label: "TUESDAY", short: "Tue" },
  { n: 3, label: "WEDNESDAY", short: "Wed" },
  { n: 4, label: "THURSDAY", short: "Thu" },
  { n: 5, label: "FRIDAY", short: "Fri" },
  { n: 6, label: "SATURDAY", short: "Sat" },
];

type Faculty = { id: string; user_id: string; name: string; subjects: string; weeklyHours: number };
type ClassGroup = { id: string; name: string; semester: string; faculty_id: string };

function Page() {
  const gen = useServerFn(generateTimetable);
  const [pool, setPool] = useState<Faculty[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [classGroupId, setClassGroupId] = useState<string>("");
  const [duration, setDuration] = useState(50);
  const [days, setDays] = useState(5);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(16);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Load faculty
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "faculty");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      let facList: Faculty[] = [];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
        const { data: courses } = await supabase.from("courses").select("name, faculty_id").in("faculty_id", ids);
        const subjMap: Record<string, string[]> = {};
        (courses ?? []).forEach((c: any) => {
          if (!c.faculty_id) return;
          (subjMap[c.faculty_id] ||= []).push(c.name);
        });
        facList = (profs ?? []).map((p: any) => ({
          id: p.user_id,
          user_id: p.user_id,
          name: p.full_name ?? "(unnamed)",
          subjects: (subjMap[p.user_id] ?? []).join(", "),
          weeklyHours: 10,
        }));
      }
      setPool(facList);
      setSelected(new Set(facList.map(f => f.id)));

      // Load class groups
      const { data: cgs } = await supabase.from("class_groups").select("*").order("semester");
      setClassGroups((cgs ?? []) as ClassGroup[]);
      if ((cgs ?? []).length) setClassGroupId((cgs as any)[0].id);
      setLoading(false);
    })();
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const updateF = (id: string, k: keyof Faculty, v: any) => {
    setPool(pool.map(f => f.id === id ? { ...f, [k]: v } : f));
  };

  const chosen = useMemo(() => pool.filter(f => selected.has(f.id)), [pool, selected]);

  const generate = async () => {
    if (chosen.length === 0) return toast.error("Select at least one faculty");
    if (!classGroupId) return toast.error("Pick a class to generate for");
    setBusy(true); setPreview([]);
    try {
      const res = await gen({
        data: {
          faculty: chosen.map(f => ({
            name: f.name,
            subjects: f.subjects.split(",").map(s => s.trim()).filter(Boolean),
            weeklyHours: Number(f.weeklyHours),
          })),
          classDurationMins: Number(duration),
          workingDays: Number(days),
          startHour: Number(startHour),
          endHour: Number(endHour),
        },
      });
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
    if (!classGroupId) return toast.error("Pick a class");

    const facByName: Record<string, string> = {};
    pool.forEach(f => { facByName[f.name.toLowerCase()] = f.user_id; });
    const matchFaculty = (name: string): string | null => {
      const n = (name ?? "").toLowerCase().trim();
      if (!n) return null;
      if (facByName[n]) return facByName[n];
      const partial = pool.find(f => {
        const fn = f.name.toLowerCase();
        return fn.includes(n) || n.includes(fn);
      });
      return partial?.user_id ?? null;
    };

    // Load existing slots (other classes) for overlap checks
    const { data: existingSlots } = await supabase
      .from("timetable_slots")
      .select("id, day_of_week, start_time, end_time, class_group_id, course_id, courses(faculty_id, name)")
      .neq("class_group_id", classGroupId);

    const overlaps = (a: { day: number; s: string; e: string }, b: { day: number; s: string; e: string }) =>
      a.day === b.day && a.s < b.e && b.s < a.e;

    const { data: existingCourses } = await supabase.from("courses").select("*");
    const byName: Record<string, any> = {};
    (existingCourses ?? []).forEach((c: any) => { byName[c.name.toLowerCase()] = c; });

    const inserts: any[] = [];
    let unmatched = 0;
    let conflicts = 0;

    for (const s of preview) {
      const facultyId = matchFaculty(s.faculty);
      if (!facultyId) { unmatched++; continue; }

      const day = DAY_MAP[s.day] ?? 1;
      // Check overlap with other classes for this faculty
      const conflict = (existingSlots ?? []).some((es: any) => {
        const fid = es.courses?.faculty_id;
        if (fid !== facultyId) return false;
        return overlaps(
          { day, s: s.start, e: s.end },
          { day: es.day_of_week, s: es.start_time.slice(0,5), e: es.end_time.slice(0,5) }
        );
      });
      if (conflict) { conflicts++; continue; }

      let course = byName[s.subject?.toLowerCase()];
      if (!course || course.faculty_id !== facultyId) {
        const code = s.subject.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 4) + Math.floor(100 + Math.random() * 900);
        const { data: nc } = await supabase.from("courses")
          .insert({ name: s.subject, code, faculty_id: facultyId })
          .select().single();
        if (nc) { course = nc; byName[s.subject.toLowerCase()] = nc; }
      }

      if (course?.id) inserts.push({
        course_id: course.id,
        class_group_id: classGroupId,
        day_of_week: day,
        start_time: s.start, end_time: s.end, room: s.room ?? "R-101",
      });
    }

    // Wipe only this class's existing slots
    await supabase.from("timetable_slots").delete().eq("class_group_id", classGroupId);
    if (inserts.length) {
      const { error } = await supabase.from("timetable_slots").insert(inserts);
      if (error) return toast.error(error.message);
    }

    const msgs = [`Saved ${inserts.length} slots for this class.`];
    if (unmatched) msgs.push(`${unmatched} skipped (no matching faculty).`);
    if (conflicts) msgs.push(`${conflicts} skipped (faculty conflict with another class).`);
    toast.success(msgs.join(" "));
  };

  const timeCols = useMemo(() => {
    const keys = Array.from(new Set(preview.map((s: any) => `${s.start}-${s.end}`))).sort();
    return keys.map(k => { const [start, end] = k.split("-"); return { start, end, label: `${start} – ${end}` }; });
  }, [preview]);

  const byDay = useMemo(() => {
    const m: Record<number, Record<string, any>> = {};
    preview.forEach((s: any) => { const d = DAY_MAP[s.day] ?? 1; (m[d] ||= {})[`${s.start}-${s.end}`] = s; });
    return m;
  }, [preview]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-accent" /> AI Timetable Generator
        </h1>
        <p className="text-muted-foreground">Pick a class, choose faculty, and generate a conflict-free schedule.</p>
      </div>

      <Card className="p-5 space-y-5">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Target class</Label>
            {classGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">No classes found. Faculty can create classes from <strong>My Students</strong>.</p>
            ) : (
              <Select value={classGroupId} onValueChange={setClassGroupId}>
                <SelectTrigger><SelectValue placeholder="Pick a class" /></SelectTrigger>
                <SelectContent>
                  {classGroups.map(c => <SelectItem key={c.id} value={c.id}>{c.semester} — {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <div><Label>Class duration (min)</Label><Input type="number" value={duration} onChange={e => setDuration(+e.target.value)} /></div>
          <div><Label>Working days/week</Label><Input type="number" value={days} onChange={e => setDays(+e.target.value)} /></div>
          <div><Label>Day starts (hr)</Label><Input type="number" value={startHour} onChange={e => setStartHour(+e.target.value)} /></div>
          <div><Label>Day ends (hr)</Label><Input type="number" value={endHour} onChange={e => setEndHour(+e.target.value)} /></div>
        </div>

        <div>
          <Label className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" /> Faculty
            <span className="text-xs text-muted-foreground font-normal">({selected.size} selected of {pool.length})</span>
          </Label>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading faculty…</p>
          ) : pool.length === 0 ? (
            <p className="text-sm text-muted-foreground">No faculty accounts yet. Create faculty users in <strong>Manage Users</strong>.</p>
          ) : (
            <div className="grid gap-2">
              <div className="hidden md:grid grid-cols-[auto_2fr_3fr_1fr] gap-2 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>Use</span><span>Name</span><span>Subjects (auto from courses)</span><span>Hrs/wk</span>
              </div>
              {pool.map(f => {
                const isOn = selected.has(f.id);
                return (
                  <div key={f.id} className={`grid md:grid-cols-[auto_2fr_3fr_1fr] gap-2 items-center p-2 rounded-lg border transition ${isOn ? "bg-primary/5 border-primary/30" : "bg-muted/20"}`}>
                    <Checkbox checked={isOn} onCheckedChange={() => toggle(f.id)} />
                    <div className="text-sm font-medium">{f.name}</div>
                    <Input placeholder="Subjects" value={f.subjects} onChange={e => updateF(f.id, "subjects", e.target.value)} />
                    <Input type="number" value={f.weeklyHours} onChange={e => updateF(f.id, "weeklyHours", +e.target.value)} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Button onClick={generate} disabled={busy || pool.length === 0 || classGroups.length === 0} className="bg-gradient-primary shadow-glow">
          {busy ? (<><Sparkles className="w-4 h-4 mr-2 animate-spin" />Generating timetable…</>) : (<><Sparkles className="w-4 h-4 mr-2" />Generate timetable</>)}
        </Button>
      </Card>

      {!busy && preview.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-2xl font-bold font-display">Preview — {classGroups.find(c => c.id === classGroupId)?.name}</h2>
              <p className="text-muted-foreground text-sm">{preview.length} slots • {chosen.length} faculty</p>
            </div>
            <Button onClick={persist} className="bg-gradient-accent text-accent-foreground">Save & publish</Button>
          </div>

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-xs border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-muted/60">
                  <th className="border p-2 text-left font-semibold">DAY / TIME</th>
                  {timeCols.map((c, idx) => <th key={idx} className="border p-2 font-semibold whitespace-nowrap">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {DAYS.slice(0, days).map(d => (
                  <tr key={d.n}>
                    <td className="border p-2 font-semibold bg-muted/30">{d.label}</td>
                    {timeCols.map((c, idx) => {
                      const slot = byDay[d.n]?.[`${c.start}-${c.end}`];
                      if (!slot) return <td key={idx} className="border p-2 text-center text-muted-foreground">—</td>;
                      return (
                        <td key={idx} className="border p-2 align-top bg-gradient-primary text-primary-foreground">
                          <div className="font-bold">{slot.subject}</div>
                          <div className="text-[10px] opacity-90">{slot.faculty}</div>
                          {slot.room && <div className="text-[10px] opacity-75 mt-0.5">{slot.room}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
