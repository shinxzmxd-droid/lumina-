import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/domains")({
  component: AdminDomainsPage,
});

type Domain = { id: string; domain: string; created_at: string };

function AdminDomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("allowed_email_domains")
      .select("*")
      .order("domain");
    setLoading(false);
    if (error) return toast.error(error.message);
    setDomains((data as Domain[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    const d = newDomain.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return toast.error("Enter a valid domain like college.edu.in");
    setBusy(true);
    const { error } = await supabase.from("allowed_email_domains").insert({ domain: d });
    setBusy(false);
    if (error) return toast.error(error.message);
    setNewDomain("");
    toast.success("Domain added");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("allowed_email_domains").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  };

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl">Allowed Email Domains</h1>
          <p className="text-sm text-muted-foreground">Only these college domains can sign up.</p>
        </div>

        <Card className="p-4 flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="e.g. mvjce.edu.in"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} disabled={busy} className="bg-gradient-primary">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Add</>}
          </Button>
        </Card>

        <Card className="divide-y">
          {loading ? (
            <div className="p-6 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : domains.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No domains yet.</div>
          ) : domains.map((d) => (
            <div key={d.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
              <div className="font-mono text-sm">@{d.domain}</div>
              <Button variant="ghost" size="icon" onClick={() => remove(d.id)} aria-label="Remove">
                <Trash2 className="w-4 h-4 text-rose-500" />
              </Button>
            </div>
          ))}
        </Card>
      </div>
    </AppShell>
  );
}
