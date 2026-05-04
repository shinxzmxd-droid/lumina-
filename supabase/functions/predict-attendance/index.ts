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

    const systemPrompt = `You are an academic attendance forecaster. For each upcoming class in a student's 2-week timetable, predict whether the student will attend (present/absent) using their historical present-rate per subject as the base probability. Slightly factor in patterns (e.g., students often skip early-morning or late-evening classes). Provide a confidence (0-1). Return ONLY structured data via the tool.`;

    const userPrompt = `Past attendance per subject:\n${JSON.stringify(subjects, null, 2)}\n\nUpcoming ${weeksAhead}-week schedule (${upcoming.length} classes):\n${JSON.stringify(upcoming, null, 2)}\n\nMin required attendance: 75%.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_forecast",
            description: "Submit per-class attendance forecast",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "1-2 sentence overall outlook" },
                overall_predicted_pct: { type: "number" },
                risk_level: { type: "string", enum: ["low", "medium", "high"] },
                classes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string" },
                      day: { type: "string" },
                      code: { type: "string" },
                      start: { type: "string" },
                      end: { type: "string" },
                      room: { type: "string" },
                      prediction: { type: "string", enum: ["present", "absent"] },
                      confidence: { type: "number" },
                      reason: { type: "string" },
                    },
                    required: ["date", "day", "code", "start", "end", "prediction", "confidence", "reason"],
                  },
                },
              },
              required: ["summary", "overall_predicted_pct", "risk_level", "classes"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_forecast" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const prediction = args ? JSON.parse(args) : null;
    return new Response(JSON.stringify({ prediction, upcoming }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
