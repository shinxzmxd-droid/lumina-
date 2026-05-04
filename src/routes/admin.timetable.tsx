import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Trash2, Plus, Users } from "lucide-react";
import { generateTimetable } from "@/server/ai.functions";
import { useServerFn } from "@tanstack/react-start";
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

const SLOTS: { start: string; end: string; label: string; kind?: "break" | "lunch" }[] = [
  { start: "08:30", end: "09:20", label: "8:30 – 9:20" },
  { start: "09:20", end: "10:10", label: "9:20 – 10:10" },
  { start: "10:10", end: "11:00", label: "10:10 – 11:00" },
  { start: "11:00", end: "11:15", label: "Short Break", kind: "break" },
  { start: "11:15", end: "12:05", label: "11:15 – 12:05" },
  { start: "12:05", end: "12:55", label: "12:05 – 12:55" },
  { start: "12:55", end: "13:30", label: "Lunch", kind: "lunch" },
  { start: "13:30", end: "14:20", label: "1:30 – 2:20" },
  { start: "14:20", end: "15:10", label: "2:20 – 3:10" },
  { start: "15:10", end: "16:00", label: "3:10 – 4:00" },
];

type Faculty = { id: string; name: string; subjects: string; weeklyHours: number };

const FACULTY_POOL: Faculty[] = [
  { id: "f1", name: "Dr. Aarav Patel", subjects: "Algorithms, Data Structures", weeklyHours: 12 },
  { id: "f2", name: "Dr. Meera Iyer", subjects: "Operating Systems, Computer Networks", weeklyHours: 10 },
  { id: "f3", name: "Prof. Rohan Sharma", subjects: "Database Systems, Big Data", weeklyHours: 10 },
  { id: "f4", name: "Dr. Ananya Rao", subjects: "Machine Learning, AI", weeklyHours: 12 },
  { id: "f5", name: "Prof. Vikram Singh", subjects: "Discrete Math, Linear Algebra", weeklyHours: 8 },
  { id: "f6", name: "Dr. Sara Khan", subjects: "Software Engineering, HCI", weeklyHours: 8 },
  { id: "f7", name: "Prof. Karthik Nair", subjects: "Compilers, Theory of Computation", weeklyHours: 9 },
  { id: "f8", name: "Dr. Priya Menon", subjects: "Cybersecurity, Cryptography", weeklyHours: 8 },
  { id: "f9", name: "Prof. Arjun Desai", subjects: "Web Tech, Cloud Computing", weeklyHours: 10 },
  { id: "f10", name: "Dr. Neha Gupta", subjects: "Computer Graphics, Image Processing", weeklyHours: 8 },
];

function findSlot(slots: any[], day: number, slot: { start: string; end: string }) {
  return slots.find(s => {
    if ((s.day_of_week ?? DAY_MAP[s.day]) !== day) return false;
    const ss = (s.start_time ?? s.start ?? "").slice(0, 5);
    const se = (s.end_time ?? s.end ?? "").slice(0, 5);
    return ss <= slot.start && se >= slot.end;
  });
}

function Page() {
  const gen = useServerFn(generateTimetable);
  const [pool, setPool] = useState<Faculty[]>(FACULTY_POOL);
  const [selected, setSelected] = useState<Set<string>>(new Set(FACULTY_POOL.slice(0, 4).map(f => f.id)));
  const [duration, setDuration] = useState(50);
  const [days, setDays] = useState(5);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(16);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const updateF = (id: string, k: keyof Faculty, v: any) => {
    setPool(pool.map(f => f.id === id ? { ...f, [k]: v } : f));
  };

  const addFaculty = () => {
    const id = `f${Date.now()}`;
    setPool([...pool, { id, name: "", subjects: "", weeklyHours: 8 }]);
    setSelected(new Set([...selected, id]));
  };

  const removeFaculty = (id: string) => {
    setPool(pool.filter(f => f.id !== id));
    const next = new Set(selected); next.delete(id); setSelected(next);
  };

  const chosen = useMemo(() => pool.filter(f => selected.has(f.id)), [pool, selected]);

  const generate = async () => {
    if (chosen.length === 0) return toast.error("Select at least one faculty");
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
    const { data: existing } = await supabase.from("courses").select("*");
    const byName: Record<string, string> = {};
    (existing ?? []).forEach((c: any) => { byName[c.name.toLowerCase()] = c.id; });

    const inserts: any[] = [];
    for (const s of preview) {
      let cid = byName[s.subject?.toLowerCase()];
      if (!cid) {
        const code = s.subject.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 4) + Math.floor(100 + Math.random() * 900);
        const { data: nc } = await supabase.from("courses").insert({ name: s.subject, code }).select().single();
        if (nc) { cid = nc.id; byName[s.subject.toLowerCase()] = cid; }
      }
      if (cid) inserts.push({
        course_id: cid,
        day_of_week: DAY_MAP[s.day] ?? 1,
        start_time: s.start, end_time: s.end, room: s.room ?? "R-101",
      });
    }
    await supabase.from("timetable_slots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error } = await supabase.from("timetable_slots").insert(inserts);
    if (error) return toast.error(error.message);
    toast.success("Timetable saved & live across the campus");
  };

  // Build cells per day (with column-span for consecutive same-subject blocks)
  const buildRow = (day: number) => {
    const cells: { content: any; span: number; key: string }[] = [];
    let i = 0;
    while (i < SLOTS.length) {
      const slot = SLOTS[i];
      if (slot.kind) { i++; continue; }
      const found = findSlot(preview, day, slot);
      if (found) {
        let span = 1; let j = i + 1;
        while (j < SLOTS.length && !SLOTS[j].kind) {
          const f2 = findSlot(preview, day, SLOTS[j]);
          if (f2 && f2.subject === found.subject && f2.faculty === found.faculty) { span++; j++; } else break;
        }
        cells.push({ content: found, span, key: `${day}-${i}` });
        i += span;
      } else {
        cells.push({ content: null, span: 1, key: `${day}-${i}` });
        i++;
      }
    }
    return cells;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-accent" /> AI Timetable Generator
          </h1>
          <p className="text-muted-foreground">Pick faculty, set parameters, get a conflict-free schedule.</p>
        </div>
      </div>

      <Card className="p-5 space-y-5">
        <div className="grid md:grid-cols-4 gap-3">
          <div><Label>Class duration (min)</Label><Input type="number" value={duration} onChange={e => setDuration(+e.target.value)} /></div>
          <div><Label>Working days/week</Label><Input type="number" value={days} onChange={e => setDays(+e.target.value)} /></div>
          <div><Label>Day starts (hr)</Label><Input type="number" value={startHour} onChange={e => setStartHour(+e.target.value)} /></div>
          <div><Label>Day ends (hr)</Label><Input type="number" value={endHour} onChange={e => setEndHour(+e.target.value)} /></div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Faculty & Roles
              <span className="text-xs text-muted-foreground font-normal">({selected.size} selected of {pool.length})</span>
            </Label>
            <Button size="sm" variant="outline" onClick={addFaculty}><Plus className="w-3 h-3 mr-1" />Add faculty</Button>
          </div>

          <div className="grid gap-2">
            <div className="hidden md:grid grid-cols-[auto_2fr_3fr_1fr_auto] gap-2 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>Use</span><span>Name</span><span>Subjects (comma separated)</span><span>Hrs/wk</span><span></span>
            </div>
            {pool.map(f => {
              const isOn = selected.has(f.id);
              return (
                <div key={f.id} className={`grid md:grid-cols-[auto_2fr_3fr_1fr_auto] gap-2 items-center p-2 rounded-lg border transition ${isOn ? "bg-primary/5 border-primary/30" : "bg-muted/20"}`}>
                  <Checkbox checked={isOn} onCheckedChange={() => toggle(f.id)} />
                  <Input placeholder="Faculty name" value={f.name} onChange={e => updateF(f.id, "name", e.target.value)} />
                  <Input placeholder="Subjects" value={f.subjects} onChange={e => updateF(f.id, "subjects", e.target.value)} />
                  <Input type="number" placeholder="hrs" value={f.weeklyHours} onChange={e => updateF(f.id, "weeklyHours", +e.target.value)} />
                  <Button size="icon" variant="ghost" onClick={() => removeFaculty(f.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              );
            })}
          </div>
        </div>

        <Button onClick={generate} disabled={busy} className="bg-gradient-primary shadow-glow">
          {busy ? (
            <><Sparkles className="w-4 h-4 mr-2 animate-spin" />Generating timetable…</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />Generate timetable</>
          )}
        </Button>
      </Card>

      {busy && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-accent animate-pulse" />
            <div>
              <p className="font-semibold">AI is crafting your timetable…</p>
              <p className="text-xs text-muted-foreground">Balancing {chosen.length} faculty across {days} days. Usually takes 5–15 seconds.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-muted/60">
                  <th className="border p-2 text-left font-semibold">DAY / TIME</th>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <th key={i} className="border p-2"><div className="h-3 bg-muted rounded animate-pulse" /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.slice(0, days).map(d => (
                  <tr key={d.n}>
                    <td className="border p-2 font-semibold bg-muted/30">{d.label}</td>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <td key={i} className="border p-2">
                        <div className="h-4 bg-muted rounded animate-pulse" style={{ animationDelay: `${(d.n + i) * 80}ms` }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!busy && preview.length > 0 && (() => {
        // Derive unique time columns directly from generated slots (sorted)
        const timeKeys = Array.from(
          new Set(preview.map((s: any) => `${s.start}-${s.end}`))
        ).sort();
        const timeCols = timeKeys.map(k => {
          const [start, end] = k.split("-");
          return { start, end, label: `${start} – ${end}` };
        });

        // Index by day -> "start-end" -> slot
        const byDay: Record<number, Record<string, any>> = {};
        preview.forEach((s: any) => {
          const d = DAY_MAP[s.day] ?? 1;
          (byDay[d] ||= {})[`${s.start}-${s.end}`] = s;
        });

        return (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-2xl font-bold font-display">Weekly Timetable Preview</h2>
                <p className="text-muted-foreground text-sm">{preview.length} slots • {chosen.length} faculty</p>
              </div>
              <Button onClick={persist} className="bg-gradient-accent text-accent-foreground">Save & publish</Button>
            </div>

            <Card className="overflow-x-auto p-0">
              <table className="w-full text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="border p-2 text-left font-semibold">DAY / TIME</th>
                    {timeCols.map((c, idx) => (
                      <th key={idx} className="border p-2 font-semibold whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.slice(0, days).map(d => (
                    <tr key={d.n}>
                      <td className="border p-2 font-semibold bg-muted/30">{d.label}</td>
                      {timeCols.map((c, idx) => {
                        const slot = byDay[d.n]?.[`${c.start}-${c.end}`];
                        if (!slot) {
                          return <td key={idx} className="border p-2 text-center text-muted-foreground">—</td>;
                        }
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
        );
      })()}
    </div>
  );
}
