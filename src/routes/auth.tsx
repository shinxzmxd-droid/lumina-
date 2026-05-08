import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { listFacultyPublic } from "@/server/public.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

export function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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
    if (!assignedFaculty) {
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
          assigned_faculty_id: assignedFaculty,
        },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — pending approval by your assigned faculty. You can sign in once approved.");
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="relative hidden md:flex flex-col justify-between p-10 bg-gradient-hero text-pastel-ink overflow-hidden">
        <div className="blob blob-lavender w-96 h-96 -top-20 -left-20" aria-hidden />
        <div className="blob blob-pink w-80 h-80 bottom-10 right-0 animate-blob-slow" style={{ animationDelay: "-5s" }} aria-hidden />
        <div className="blob blob-mint w-64 h-64 top-1/2 left-1/3" style={{ animationDelay: "-9s" }} aria-hidden />
        <div className="relative flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-white/70 backdrop-blur grid place-items-center shadow-elegant">
            <GraduationCap className="w-5 h-5 text-pastel-lavender-strong" />
          </div>
          <span className="font-display text-2xl">Lumina</span>
        </div>
        <div className="relative animate-fade-up">
          <h2 className="font-display text-5xl mb-3 leading-tight">Your campus,<br/>unified.</h2>
          <p className="text-pastel-muted max-w-md">
            "Your campus, powered by an AI that understands your learning."
          </p>
        </div>
        <div className="relative text-xs text-pastel-muted">© Lumina</div>
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
                <Label className="mb-2 block">Assigned faculty (will approve you)</Label>
                <Select value={assignedFaculty} onValueChange={setAssignedFaculty}>
                  <SelectTrigger><SelectValue placeholder={facultyList.length ? "Pick a faculty" : "No faculty available yet"} /></SelectTrigger>
                  <SelectContent>
                    {facultyList.map(f => <SelectItem key={f.user_id} value={f.user_id}>{f.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">Faculty and admin accounts can only be created by an existing admin.</p>
              </div>
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
