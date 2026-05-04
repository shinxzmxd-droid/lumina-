import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { subjects, timetable, weeksAhead = 4 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const systemPrompt = `You are an academic attendance prediction assistant. Given a student's past per-subject attendance and their weekly timetable (number of classes/week per subject), predict their attendance over the next ${weeksAhead} weeks per subject. Use historical present-rate as the base probability, factor in class frequency, and produce a realistic forecast. Return ONLY structured data via the tool.`;

    const userPrompt = `Past attendance per subject:\n${JSON.stringify(subjects, null, 2)}\n\nWeekly timetable (classes per week per subject):\n${JSON.stringify(timetable, null, 2)}\n\nPredict for next ${weeksAhead} weeks. Min required: 75%.`;

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
            name: "submit_prediction",
            description: "Submit attendance forecast",
            parameters: {
              type: "object",
              properties: {
                overall_predicted_pct: { type: "number" },
                risk_level: { type: "string", enum: ["low", "medium", "high"] },
                summary: { type: "string", description: "1-2 sentence overall summary" },
                per_subject: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      code: { type: "string" },
                      current_pct: { type: "number" },
                      predicted_pct: { type: "number" },
                      classes_to_attend: { type: "number", description: "Min classes to attend in next period to stay >=75%" },
                      advice: { type: "string" },
                    },
                    required: ["code", "current_pct", "predicted_pct", "classes_to_attend", "advice"],
                  },
                },
              },
              required: ["overall_predicted_pct", "risk_level", "summary", "per_subject"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_prediction" } },
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
    return new Response(JSON.stringify({ prediction }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
