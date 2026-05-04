import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/timetable")({
  component: () => <RequireAuth><Page /></RequireAuth>,
});

const DAYS = [
  { n: 1, label: "MONDAY" },
  { n: 2, label: "TUESDAY" },
  { n: 3, label: "WEDNESDAY" },
  { n: 4, label: "THURSDAY" },
  { n: 5, label: "FRIDAY" },
  { n: 6, label: "SATURDAY" },
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

function findSlot(slots: any[], day: number, slot: { start: string; end: string }) {
  return slots.find(s => {
    if (s.day_of_week !== day) return false;
    const ss = (s.start_time as string).slice(0,5);
    const se = (s.end_time as string).slice(0,5);
    // either exact match or this slot covers the period (lab covers multiple periods)
    return ss <= slot.start && se >= slot.end;
  });
}

function Page() {
  const [slots, setSlots] = useState<any[]>([]);
  const [room, setRoom] = useState("306");

  useEffect(() => {
    supabase.from("timetable_slots").select("*, courses(code, name)").order("day_of_week").order("start_time").then(({data})=>{
      setSlots(data ?? []);
      const r = (data ?? []).find((s: any) => s.room && s.room.match(/\d/));
      if (r) setRoom(r.room);
    });
  }, []);

  const periodSlots = useMemo(() => SLOTS.filter(s => !s.kind), []);

  // For each day, build cells: combine consecutive same-course assignments into spans (e.g., labs)
  const buildRow = (day: number) => {
    const cells: { content: any; span: number; key: string }[] = [];
    let i = 0;
    while (i < SLOTS.length) {
      const slot = SLOTS[i];
      if (slot.kind) { i++; continue; } // breaks/lunch are separate columns
      const found = findSlot(slots, day, slot);
      if (found) {
        // count consecutive period slots covered by same entry
        let span = 1;
        let j = i + 1;
        while (j < SLOTS.length && !SLOTS[j].kind) {
          const f2 = findSlot(slots, day, SLOTS[j]);
          if (f2 && f2.id === found.id) { span++; j++; } else break;
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
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold font-display">Weekly Timetable</h1>
          <p className="text-muted-foreground text-sm">Sem IV 'B' • Information Science & Engineering • Room {room}</p>
        </div>
        <div className="text-xs text-muted-foreground">Academic Year 2025-26 (Even Semester)</div>
      </div>

      {slots.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No timetable yet.</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-muted/60">
                <th className="border p-2 text-left font-semibold">DAY / TIME</th>
                {SLOTS.map((s, idx) => (
                  <th key={idx} className={`border p-2 font-semibold ${s.kind ? "bg-muted text-muted-foreground" : ""}`}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(d => {
                const row = buildRow(d.n);
                return (
                  <tr key={d.n}>
                    <td className="border p-2 font-semibold bg-muted/30">{d.label}</td>
                    {(() => {
                      const tds: JSX.Element[] = [];
                      let cellIdx = 0;
                      SLOTS.forEach((s, idx) => {
                        if (s.kind) {
                          tds.push(
                            <td key={`b-${d.n}-${idx}`} className="border p-1 text-center bg-muted/40 text-muted-foreground italic" style={{writingMode: "vertical-rl"} as any}>
                              {s.label}
                            </td>
                          );
                          return;
                        }
                        const cell = row[cellIdx];
                        if (!cell) return;
                        // Skip if previous span covered this column
                        const prev = row[cellIdx - 1];
                        // Determine if this column is the start of a cell
                        // We need to track: which period index does this cell start at?
                        // Simpler: rebuild via index tracking outside.
                        if ((cell as any)._consumed) { return; }
                        const colSpan = cell.span;
                        // mark consumed
                        for (let k = 1; k < colSpan; k++) {
                          if (row[cellIdx + k]) (row[cellIdx + k] as any)._consumed = true;
                        }
                        if (cell.content) {
                          tds.push(
                            <td key={cell.key} colSpan={colSpan} className="border p-2 align-top bg-gradient-primary text-primary-foreground">
                              <div className="font-bold">{cell.content.courses?.code}</div>
                              <div className="text-[10px] opacity-90">{cell.content.courses?.name}</div>
                              {cell.content.room && <div className="text-[10px] opacity-75 mt-0.5">{cell.content.room}</div>}
                            </td>
                          );
                        } else {
                          tds.push(<td key={cell.key} className="border p-2 text-center text-muted-foreground">—</td>);
                        }
                        cellIdx += colSpan;
                      });
                      return tds;
                    })()}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="font-display font-semibold mb-3">Course Legend</h3>
        <CourseLegend />
      </Card>
    </div>
  );
}

function CourseLegend() {
  const [courses, setCourses] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("courses").select("*").order("code").then(({data}) => setCourses(data ?? []));
  }, []);
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
      {courses.map(c => (
        <div key={c.id} className="flex items-center gap-2 border-l-2 border-primary pl-3 py-1">
          <span className="font-mono font-semibold text-xs bg-primary/10 px-1.5 py-0.5 rounded">{c.code}</span>
          <span className="text-foreground/80">{c.name}</span>
        </div>
      ))}
    </div>
  );
}
