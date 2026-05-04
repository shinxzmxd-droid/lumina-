import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callAI(systemPrompt: string, userPrompt: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${t}`);
  }
  const data: any = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

export const askTutor = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      question: z.string().min(1),
      context: z.string().default(""),
      courseName: z.string().default(""),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const sys = `You are Lumina, a friendly voice-first AI tutor for college students.
Course: ${data.courseName || "General"}.
Ground answers strictly in the provided course material when relevant.
Keep answers concise (2-4 short paragraphs), conversational, and easy to read aloud.
If the student asks for a quiz, generate 3 short questions with answers.
If asked for a summary, give clear bullet points.

Course material:
"""
${data.context.slice(0, 8000) || "(no material uploaded — answer from general knowledge but say so briefly)"}
"""`;
    const text = await callAI(sys, data.question);
    return { answer: text };
  });

export const generateTimetable = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      faculty: z.array(z.object({
        name: z.string(),
        subjects: z.array(z.string()),
        weeklyHours: z.number().min(1).max(40),
      })).min(1),
      classDurationMins: z.number().min(30).max(180),
      workingDays: z.number().min(1).max(7),
      startHour: z.number().min(6).max(12),
      endHour: z.number().min(12).max(22),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const sys = `You are a university timetable generator. Output ONLY valid JSON, no markdown.
Schema:
{ "slots": [ { "day": "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat", "start": "HH:MM", "end": "HH:MM", "subject": string, "faculty": string, "room": string } ] }
Rules:
- Working days: first ${data.workingDays} weekdays starting Monday.
- Each class is exactly ${data.classDurationMins} minutes.
- Day window: ${data.startHour}:00 to ${data.endHour}:00 with one 1-hour lunch around 12:00-13:00.
- Respect each faculty's weekly hours total (one slot = classDurationMins).
- No faculty double-booked at the same time.
- Distribute subjects evenly across the week.
- Use rooms R-101, R-102, R-201, R-202.`;
    const userPrompt = `Faculty:\n${JSON.stringify(data.faculty, null, 2)}\nReturn the JSON now.`;
    const raw = await callAI(sys, userPrompt);
    const clean = raw.replace(/```json|```/g, "").trim();
    try {
      const parsed = JSON.parse(clean);
      return { ok: true, ...parsed };
    } catch {
      return { ok: false, raw };
    }
  });
