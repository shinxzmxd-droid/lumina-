import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Users, Plus, Trash2, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/faculty/onboarding")({
  component: () => <RequireAuth roles={["faculty"]}><Page /></RequireAuth>,
});

const SEMESTERS = ["1st Semester","2nd Semester","3rd Semester","4th Semester","5th Semester","6th Semester","7th Semester","8th Semester"];

function Page() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);

  // courses
  const [courses, setCourses] = useState<{ code: string; name: string }[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  // classes
  const [classes, setClasses] = useState<{ name: string; semester: string }[]>([]);
  const [cName, setCName] = useState("");
  const [cSem, setCSem] = useState("3rd Semester");

  // skip onboarding if already configured
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { count } = await supabase.from("courses").select("*", { count: "exact", head: true }).eq("faculty_id", user.id);
      if ((count ?? 0) > 0) navigate({ to: "/dashboard" });
    })();
  }, [user]);

  const addCourse = () => {
    if (!code.trim() || !name.trim()) return toast.error("Code & name required");
    setCourses([...courses, { code: code.trim(), name: name.trim() }]);
    setCode(""); setName("");
  };
  const addClass = () => {
    if (!cName.trim()) return toast.error("Class name required");
    setClasses([...classes, { name: cName.trim(), semester: cSem }]);
    setCName("");
  };

  const finish = async () => {
    if (courses.length === 0) return toast.error("Add at least one course");
    setBusy(true);
    try {
      const { error: ce } = await supabase.from("courses").insert(
        courses.map(c => ({ ...c, faculty_id: user!.id }))
      );
      if (ce) throw ce;
      if (classes.length > 0) {
        const { error: ge } = await supabase.from("class_groups").insert(
          classes.map(c => ({ ...c, faculty_id: user!.id }))
        );
        if (ge) throw ge;
      }
      toast.success("Welcome aboard! Setup complete.");
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e.message ?? "Setup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-gradient-primary grid place-items-center shadow-glow">
          <Sparkles className="w-6 h-6 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold font-display">Welcome to Lumina</h1>
        <p className="text-muted-foreground">Let's set up the courses you teach and the classes you handle.</p>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs">
        <Badge variant={step === 1 ? "default" : "outline"}>1. Courses</Badge>
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
        <Badge variant={step === 2 ? "default" : "outline"}>2. Classes</Badge>
      </div>

      {step === 1 && (
        <Card className="p-5 space-y-4">
          <h2 className="font-display font-semibold flex items-center gap-2"><BookOpen className="w-4 h-4" /> Courses you'll teach</h2>
          <div className="grid sm:grid-cols-[120px_1fr_auto] gap-2 items-end">
            <div><Label>Code</Label><Input value={code} onChange={e=>setCode(e.target.value)} placeholder="CS101" /></div>
            <div><Label>Name</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Intro to CS" /></div>
            <Button onClick={addCourse}><Plus className="w-4 h-4 mr-1" />Add</Button>
          </div>
          <div className="space-y-2">
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No courses added yet.</p>
            ) : courses.map((c, i) => (
              <div key={i} className="flex items-center justify-between border rounded-lg p-3">
                <div><span className="font-mono text-sm mr-2">{c.code}</span>{c.name}</div>
                <Button size="icon" variant="ghost" onClick={()=>setCourses(courses.filter((_,j)=>j!==i))}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={()=>setStep(2)} disabled={courses.length===0} className="bg-gradient-primary">
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-5 space-y-4">
          <h2 className="font-display font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Classes you handle</h2>
          <p className="text-xs text-muted-foreground">Optional — you can also create these later.</p>
          <div className="grid sm:grid-cols-[1fr_180px_auto] gap-2 items-end">
            <div><Label>Class name</Label><Input value={cName} onChange={e=>setCName(e.target.value)} placeholder="CSE-A" /></div>
            <div>
              <Label>Semester</Label>
              <Select value={cSem} onValueChange={setCSem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map(s=> <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addClass}><Plus className="w-4 h-4 mr-1" />Add</Button>
          </div>
          <div className="space-y-2">
            {classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No classes added yet.</p>
            ) : classes.map((c, i) => (
              <div key={i} className="flex items-center justify-between border rounded-lg p-3">
                <div>{c.name} <Badge variant="outline" className="ml-2">{c.semester}</Badge></div>
                <Button size="icon" variant="ghost" onClick={()=>setClasses(classes.filter((_,j)=>j!==i))}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={()=>setStep(1)}>Back</Button>
            <Button onClick={finish} disabled={busy} className="bg-gradient-primary">
              {busy ? "Saving…" : "Finish setup"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
