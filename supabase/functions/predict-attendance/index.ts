import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { subjects, slots, weeksAhead = 2 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    // Build concrete future schedule from timetable slots
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = weeksAhead * 7;
    const upcoming: Array<{ date: string; day: string; code: string; start: string; end: string; room?: string }> = [];
    for (let i = 1; i <= horizon; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dow = d.getDay();
      const iso = d.toISOString().slice(0, 10);
      slots
        .filter((s: any) => Number(s.day_of_week) === dow)
        .forEach((s: any) => upcoming.push({
          date: iso, day: DAYS[dow], code: s.code, start: s.start_time, end: s.end_time, room: s.room,
        }));
    }
    upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

    // Per-subject projection assuming student attends every upcoming class
    const upcomingBySubject: Record<string, number> = {};
    upcoming.forEach((c) => { upcomingBySubject[c.code] = (upcomingBySubject[c.code] ?? 0) + 1; });

    const per_subject = (subjects as any[]).map((s) => {
      const add = upcomingBySubject[s.code] ?? 0;
      const newPresent = s.present + add;
      const newTotal = s.total + add;
      const projected_pct = newTotal ? Math.round((newPresent / newTotal) * 100) : 0;
      return {
        code: s.code,
        name: s.name,
        current_pct: s.current_pct,
        upcoming_classes: add,
        projected_present: newPresent,
        projected_total: newTotal,
        projected_pct,
      };
    });

    // Add subjects that only appear in timetable but not in past attendance
    Object.keys(upcomingBySubject).forEach((code) => {
      if (!per_subject.find((p) => p.code === code)) {
        const add = upcomingBySubject[code];
        per_subject.push({
          code, name: code, current_pct: 0, upcoming_classes: add,
          projected_present: add, projected_total: add, projected_pct: 100,
        });
      }
    });

    const totalPresent = per_subject.reduce((a, p) => a + p.projected_present, 0);
    const totalAll = per_subject.reduce((a, p) => a + p.projected_total, 0);
    const overall_predicted_pct = totalAll ? Math.round((totalPresent / totalAll) * 100) : 0;
    const belowMin = per_subject.filter((p) => p.projected_pct < 75);
    const risk_level = belowMin.length === 0 ? "low" : belowMin.length <= 1 ? "medium" : "high";

    // Ask AI for a friendly 1-2 sentence summary
    let summary = `If you attend every class for the next ${weeksAhead} weeks, your overall attendance becomes ${overall_predicted_pct}%.`;
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a concise academic advisor. Reply in 1-2 short sentences only." },
            { role: "user", content: `Student attends every class for next ${weeksAhead} weeks. Overall ${overall_predicted_pct}%. Per subject: ${JSON.stringify(per_subject.map(p => ({ code: p.code, current: p.current_pct, projected: p.projected_pct })))}. Min required is 75%. Give an encouraging, specific summary.` },
          ],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) summary = text;
      } else if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (e) {
      console.error("summary AI error", e);
    }

    const classes = upcoming.map((c) => ({ ...c, prediction: "present", confidence: 1, reason: "Assumed attended" }));

    return new Response(
      JSON.stringify({
        prediction: { summary, overall_predicted_pct, risk_level, per_subject, classes },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
