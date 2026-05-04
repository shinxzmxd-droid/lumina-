import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/timetable")({
  component: () => <RequireAuth><Page /></RequireAuth>,
});

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Page() {
  const [slots, setSlots] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("timetable_slots").select("*, courses(code, name)").order("day_of_week").order("start_time").then(({data})=>setSlots(data ?? []));
  }, []);

  const grid: Record<number, any[]> = {1:[],2:[],3:[],4:[],5:[],6:[]};
  slots.forEach(s => grid[s.day_of_week]?.push(s));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Weekly timetable</h1>
      {slots.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No timetable yet. Admins can generate one from the Timetable Generator.</Card>
      ) : (
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1,2,3,4,5,6].map(d => (
            <Card key={d} className="p-4">
              <div className="font-display font-semibold mb-3">{DAYS[d]}</div>
              <div className="space-y-2">
                {grid[d].length === 0 && <div className="text-xs text-muted-foreground">—</div>}
                {grid[d].map(s => (
                  <div key={s.id} className="bg-gradient-primary text-primary-foreground rounded-lg p-3 text-xs">
                    <div className="font-semibold">{s.courses?.code}</div>
                    <div className="opacity-80">{s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}</div>
                    {s.room && <div className="opacity-70 mt-1">{s.room}</div>}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
