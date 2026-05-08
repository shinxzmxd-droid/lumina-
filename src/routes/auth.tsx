import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listFacultyPublic } from "@/server/public.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const PERSONAL_DOMAINS = new Set([
  "gmail.com","yahoo.com","yahoo.co.in","outlook.com","hotmail.com","live.com",
  "protonmail.com","proton.me","icloud.com","aol.com","mail.com","zoho.com",
  "gmx.com","yandex.com","rediffmail.com","msn.com",
]);

function getDomain(email: string) {
  const at = email.indexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

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
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const fetchFaculty = useServerFn(listFacultyPublic);

  useEffect(() => {
    fetchFaculty().then((r) => setFacultyList(r.faculty)).catch(() => {});
    supabase.from("allowed_email_domains").select("domain").then(({ data }) => {
      if (data) setAllowedDomains(data.map((d: any) => d.domain.toLowerCase()));
    });
  }, []);

  const domain = getDomain(email);
  const validation = useMemo(() => {
    if (!email) return { state: "idle" as const, msg: "" };
    if (!email.includes("@") || !domain) return { state: "idle" as const, msg: "" };
    if (PERSONAL_DOMAINS.has(domain)) {
      return { state: "invalid" as const, msg: "Please use your official college email address to continue." };
    }
    if (allowedDomains.length && !allowedDomains.includes(domain)) {
      return { state: "invalid" as const, msg: "This domain isn't on the approved college list." };
    }
    if (allowedDomains.includes(domain)) {
      return { state: "valid" as const, msg: "Verified college domain ✓" };
    }
    return { state: "idle" as const, msg: "" };
  }, [email, domain, allowedDomains]);

  const emailOk = validation.state === "valid";

  const signIn = async () => {
    if (!emailOk) return toast.error("Please use your official college email address to continue.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  const signUp = async () => {
    if (!emailOk) return toast.error("Please use your official college email address to continue.");
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
    if (error) {
      const msg = /college email|check_violation|domain/i.test(error.message)
        ? "Please use your official college email address to continue."
        : error.message;
      return toast.error(msg);
    }
    toast.success("Account created — check your email to verify, then await faculty approval.");
  };

  const EmailField = (
    <div>
      <Label>College email</Label>
      <div className="relative">
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@mvjce.edu.in"
          aria-invalid={validation.state === "invalid"}
          className={`transition-all pr-9 ${
            validation.state === "valid" ? "border-emerald-400 focus-visible:ring-emerald-300" :
            validation.state === "invalid" ? "border-rose-400 focus-visible:ring-rose-300" : ""
          }`}
        />
        {validation.state === "valid" && (
          <Check className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 animate-fade-in" />
        )}
        {validation.state === "invalid" && (
          <X className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 animate-fade-in" />
        )}
      </div>
      <p className={`text-xs mt-1.5 transition-colors ${
        validation.state === "invalid" ? "text-rose-600" :
        validation.state === "valid" ? "text-emerald-600" : "text-muted-foreground"
      }`}>
        {validation.msg || "Only institution-issued email addresses are allowed."}
      </p>
    </div>
  );

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
            Sign in with your official college email to access your campus space.
          </p>
        </div>
        <div className="relative text-xs text-pastel-muted">© Lumina</div>
      </div>

      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm animate-fade-up">
          <h1 className="font-display text-2xl font-bold mb-1">Welcome</h1>
          <p className="text-sm text-muted-foreground mb-6">College-only access</p>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-3">
              {EmailField}
              <div><Label>Password</Label><Input type="password" autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
              <Button className="w-full bg-gradient-primary shadow-glow transition-all" disabled={busy || !emailOk || !password} onClick={signIn}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-3">
              <div><Label>Full name</Label><Input value={name} onChange={(e)=>setName(e.target.value)} /></div>
              {EmailField}
              <div><Label>Password</Label><Input type="password" autoComplete="new-password" value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
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
              <Button className="w-full bg-gradient-primary shadow-glow transition-all" disabled={busy || !emailOk || !password || !name} onClick={signUp}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create account"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
