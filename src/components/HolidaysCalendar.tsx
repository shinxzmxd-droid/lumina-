import { Calendar } from "@/components/ui/calendar";
import { useMemo, useState } from "react";

// India public holidays 2026 (representative list)
const HOLIDAYS_2026: { date: string; name: string }[] = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-14", name: "Pongal / Makar Sankranti" },
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-03-03", name: "Holi" },
  { date: "2026-03-21", name: "Ramzan / Eid-ul-Fitr" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-14", name: "Ambedkar Jayanti" },
  { date: "2026-05-01", name: "Labour Day" },
  { date: "2026-05-27", name: "Eid-ul-Adha" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-08-26", name: "Janmashtami" },
  { date: "2026-09-17", name: "Ganesh Chaturthi" },
  { date: "2026-10-02", name: "Gandhi Jayanti" },
  { date: "2026-10-20", name: "Dussehra" },
  { date: "2026-11-08", name: "Diwali" },
  { date: "2026-11-24", name: "Guru Nanak Jayanti" },
  { date: "2026-12-25", name: "Christmas" },
];

export function HolidaysCalendar() {
  const [month, setMonth] = useState<Date>(new Date());
  const holidayDates = useMemo(
    () => HOLIDAYS_2026.map(h => {
      const [y, m, d] = h.date.split("-").map(Number);
      return new Date(y, m - 1, d);
    }),
    []
  );

  const upcoming = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return HOLIDAYS_2026
      .map(h => {
        const [y, m, d] = h.date.split("-").map(Number);
        return { ...h, dt: new Date(y, m - 1, d) };
      })
      .filter(h => h.dt >= today)
      .slice(0, 5);
  }, []);

  return (
    <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg md:text-xl font-bold text-pastel-ink">Public holidays</h3>
        <span className="text-xs px-3 py-1 rounded-full bg-pastel-yellow text-pastel-ink">2026</span>
      </div>
      <div className="flex flex-col lg:flex-row gap-5">
        <div className="flex justify-center">
          <Calendar
            mode="multiple"
            selected={holidayDates}
            month={month}
            onMonthChange={setMonth}
            modifiers={{ holiday: holidayDates }}
            modifiersClassNames={{ holiday: "bg-pastel-pink text-pastel-ink rounded-full font-semibold" }}
            className="p-2 pointer-events-auto"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-pastel-muted mb-2">Upcoming</div>
          <ul className="space-y-2">
            {upcoming.length === 0 && <li className="text-sm text-pastel-muted">No upcoming holidays.</li>}
            {upcoming.map(h => (
              <li key={h.date} className="flex items-center gap-3 p-3 rounded-2xl bg-pastel-cream">
                <div className="w-11 h-11 rounded-xl bg-pastel-pink grid place-items-center text-pastel-ink font-bold">
                  {h.dt.getDate()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-pastel-ink truncate">{h.name}</div>
                  <div className="text-xs text-pastel-muted">
                    {h.dt.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
