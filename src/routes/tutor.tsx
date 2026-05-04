import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { askTutor } from "@/server/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, Send, Volume2, VolumeX, BrainCircuit, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tutor")({
  component: () => <RequireAuth roles={["student"]}><Page /></RequireAuth>,
});

type Msg = { role: "user" | "assistant"; text: string };

function Page() {
  const { user } = useAuth();
  const ask = useServerFn(askTutor);
  const [courses, setCourses] = useState<any[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [materials, setMaterials] = useState<any[]>([]);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Hi! I'm Lumina, your AI tutor. Pick a course, then ask me anything — or tap the mic and just talk." }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("enrollments").select("courses(*)").eq("student_id", user.id).then(({data}) => {
      setCourses((data ?? []).map((d: any) => d.courses).filter(Boolean));
    });
  }, [user]);

  useEffect(() => {
    if (!courseId) { setMaterials([]); return; }
    supabase.from("course_materials").select("*").eq("course_id", courseId).then(({data}) => setMaterials(data ?? []));
  }, [courseId]);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05; u.pitch = 1;
    window.speechSynthesis.speak(u);
  };

  const send = async (q?: string) => {
    const text = (q ?? input).trim();
    if (!text) return;
    setMessages(m => [...m, { role: "user", text }]);
    setInput(""); setBusy(true);
    try {
      const ctx = materials.map(m => `# ${m.title}\n${m.content}`).join("\n\n");
      const courseName = courses.find(c => c.id === courseId)?.name ?? "";
      const { answer } = await ask({ data: { question: text, context: ctx, courseName } });
      setMessages(m => [...m, { role: "assistant", text: answer }]);
      await supabase.from("ai_interactions").insert({ user_id: user!.id, course_id: courseId || null, mode: "chat", prompt: text, response: answer });
      speak(answer);
    } catch (e: any) {
      toast.error(e.message ?? "AI failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return toast.error("Voice not supported in this browser");
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const r = new SR();
    r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setListening(false);
      send(t);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recRef.current = r; r.start(); setListening(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-accent" /> AI Tutor
          </h1>
          <p className="text-muted-foreground">Voice-first. Grounded in your course materials.</p>
        </div>
        <div className="w-64">
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger><SelectValue placeholder="Select course (optional)" /></SelectTrigger>
            <SelectContent>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-0 overflow-hidden flex flex-col h-[60vh]">
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-muted/30 to-background">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-gradient-primary text-primary-foreground" : "bg-card border shadow-elegant"
              }`}>
                {m.role === "assistant" && (
                  <div className="flex items-center gap-2 text-xs text-accent mb-1 font-semibold">
                    <BrainCircuit className="w-3 h-3" /> Lumina
                    <button onClick={()=>speak(m.text)} className="ml-auto opacity-60 hover:opacity-100"><Volume2 className="w-3 h-3" /></button>
                  </div>
                )}
                {m.text}
              </div>
            </div>
          ))}
          {busy && <div className="text-xs text-muted-foreground animate-pulse">Lumina is thinking…</div>}
        </div>

        <div className="border-t p-3 flex items-center gap-2 bg-card">
          <Button size="icon" variant={listening ? "destructive" : "outline"} onClick={toggleMic} className={listening ? "animate-pulse" : ""}>
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          <Input
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter" && send()}
            placeholder={listening ? "Listening…" : "Ask a question, or tap the mic"}
            disabled={busy}
          />
          <Button onClick={()=>send()} disabled={busy} className="bg-gradient-primary"><Send className="w-4 h-4" /></Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {["Summarize this course","Quiz me with 3 questions","Explain the hardest concept simply"].map(s => (
          <Button key={s} size="sm" variant="outline" onClick={()=>send(s)}>{s}</Button>
        ))}
      </div>
    </div>
  );
}
