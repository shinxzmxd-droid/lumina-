import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { listFacultyPublic } from "@/server/public.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "faculty" | "admin">("student");
  const [assignedFaculty, setAssignedFaculty] = useState<string>("");
  const [facultyList, setFacultyList] = useState<{ user_id: string; full_name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const fetchFaculty = useServerFn(listFacultyPublic);

  useEffect(() => {
    fetchFaculty().then((r) => setFacultyList(r.faculty)).catch(() => {});
  }, []);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  const signUp = async () => {
    if (role === "student" && !assignedFaculty) {
      return toast.error("Please pick the faculty who will approve your account");
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: name,
          role,
          ...(role === "student" ? { assigned_faculty_id: assignedFaculty } : {}),
        },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const who = role === "student" ? "your assigned faculty" : "an admin";
    toast.success(`Account created — pending approval by ${who}. You can sign in once approved.`);
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-hero text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-xl">Lumina</span>
        </div>
        <div>
          <h2 className="font-display text-4xl font-bold mb-3">Your campus, unified.</h2>
          <p className="text-primary-foreground/70 max-w-md">
            "Your campus, powered by an AI that understands your learning."
          </p>
        </div>
        <div className="text-xs text-primary-foreground/50">© Lumina · MVP</div>
      </div>

      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-bold mb-1">Welcome</h1>
          <p className="text-sm text-muted-foreground mb-6">Sign in or create an account</p>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-3">
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
              <div><Label>Password</Label><Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
              <Button className="w-full bg-gradient-primary shadow-glow" disabled={busy} onClick={signIn}>
                {busy ? "…" : "Sign in"}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-3">
              <div><Label>Full name</Label><Input value={name} onChange={(e)=>setName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
              <div><Label>Password</Label><Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
              <div>
                <Label className="mb-2 block">I am a</Label>
                <RadioGroup value={role} onValueChange={(v)=>setRole(v as any)} className="grid grid-cols-3 gap-2">
                  {(["student","faculty","admin"] as const).map(r=>(
                    <Label key={r} className={`border rounded-lg p-2 text-center cursor-pointer capitalize text-sm ${role===r?"border-primary bg-primary/5":""}`}>
                      <RadioGroupItem value={r} className="sr-only" />{r}
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              {role === "student" && (
                <div>
                  <Label className="mb-2 block">Assigned faculty (will approve you)</Label>
                  <Select value={assignedFaculty} onValueChange={setAssignedFaculty}>
                    <SelectTrigger><SelectValue placeholder={facultyList.length ? "Pick a faculty" : "No faculty available yet"} /></SelectTrigger>
                    <SelectContent>
                      {facultyList.map(f => <SelectItem key={f.user_id} value={f.user_id}>{f.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button className="w-full bg-gradient-primary shadow-glow" disabled={busy} onClick={signUp}>
                {busy ? "…" : "Create account"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
