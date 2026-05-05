import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { GraduationCap, Mic, BarChart3, Calendar, Sparkles, ArrowRight, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-hero text-primary-foreground overflow-hidden">
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-xl">Lumina</span>
        </div>
        <Link to="/auth">
          <Button variant="secondary">Sign in</Button>
        </Link>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 text-center relative">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm mb-8">
          <Sparkles className="w-4 h-4 text-accent" /> Voice-first AI · Built for modern campuses
        </div>
        <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] mb-6 font-display">
          The campus OS that <br/>
          <span className="bg-gradient-accent bg-clip-text text-transparent">talks back.</span>
        </h1>
        <p className="text-lg md:text-xl text-primary-foreground/70 max-w-2xl mx-auto mb-10">
          One platform for students, faculty and admins. Real-time attendance, smart timetables,
          leave workflows — and a voice AI tutor grounded in your syllabus.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-accent text-accent-foreground hover:opacity-90 shadow-glow">
              Get started <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-6 text-left">
          {[
            { i: ClipboardCheck, t: "Real-time attendance", d: "Students never face surprises. Faculty mark in seconds." },
            { i: Mic, t: "Voice AI tutor", d: "Talk to your courses. Summaries, quizzes, concept clarifications." },
            { i: BarChart3, t: "Admin intelligence", d: "Campus-wide metrics: attendance, productivity, AI engagement." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="glass rounded-2xl p-6">
              <Icon className="w-8 h-8 text-accent mb-4" />
              <h3 className="font-display font-semibold text-lg mb-2">{t}</h3>
              <p className="text-sm text-primary-foreground/70">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
