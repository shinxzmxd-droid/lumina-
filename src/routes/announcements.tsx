import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Megaphone, CalendarHeart, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/announcements")({
  component: () => <RequireAuth><Page /></RequireAuth>,
});

function Page() {
  const { user, role } = useAuth();
  const canEdit = role === "faculty" || role === "admin";
  const [ann, setAnn] = useState<any[]>([]);
  const [evs, setEvs] = useState<any[]>([]);
  const [aTitle, setATitle] = useState(""); const [aBody, setABody] = useState("");
  const [eTitle, setETitle] = useState(""); const [eDate, setEDate] = useState("");
  const [eLoc, setELoc] = useState(""); const [eDesc, setEDesc] = useState("");

  const load = async () => {
    const { data: a } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setAnn(a ?? []);
    const { data: e } = await supabase.from("events").select("*").order("event_date");
    setEvs(e ?? []);
  };
  useEffect(() => { load(); }, []);

  const addAnn = async () => {
    if (!aTitle) return toast.error("Title required");
    const { error } = await supabase.from("announcements").insert({ title: aTitle, body: aBody, created_by: user!.id });
    if (error) return toast.error(error.message);
    setATitle(""); setABody(""); toast.success("Announcement posted"); load();
  };
  const addEv = async () => {
    if (!eTitle || !eDate) return toast.error("Title and date required");
    const { error } = await supabase.from("events").insert({ title: eTitle, event_date: eDate, location: eLoc, description: eDesc, created_by: user!.id });
    if (error) return toast.error(error.message);
    setETitle(""); setEDate(""); setELoc(""); setEDesc(""); toast.success("Event added"); load();
  };
  const delAnn = async (id: string) => {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const delEv = async (id: string) => {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-display">Announcements & Events</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Megaphone className="w-4 h-4" /> Announcements</h2>
          {canEdit && (
            <div className="space-y-2 border rounded-lg p-3">
              <div><Label>Title</Label><Input value={aTitle} onChange={e=>setATitle(e.target.value)} placeholder="Holiday notice" /></div>
              <div><Label>Body</Label><Textarea value={aBody} onChange={e=>setABody(e.target.value)} rows={3} /></div>
              <Button onClick={addAnn} className="bg-gradient-primary"><Plus className="w-4 h-4 mr-2" />Post</Button>
            </div>
          )}
          <ul className="space-y-2">
            {ann.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
            {ann.map(a => (
              <li key={a.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{a.title}</div>
                  {a.body && <div className="text-sm text-muted-foreground">{a.body}</div>}
                  <div className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString()}</div>
                </div>
                {(canEdit && (a.created_by === user?.id || role === "admin")) && (
                  <Button size="icon" variant="ghost" onClick={()=>delAnn(a.id)}><Trash2 className="w-4 h-4" /></Button>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><CalendarHeart className="w-4 h-4" /> Events</h2>
          {canEdit && (
            <div className="space-y-2 border rounded-lg p-3">
              <div className="grid sm:grid-cols-2 gap-2">
                <div><Label>Title</Label><Input value={eTitle} onChange={e=>setETitle(e.target.value)} placeholder="Hackathon 2026" /></div>
                <div><Label>Date</Label><Input type="date" value={eDate} onChange={e=>setEDate(e.target.value)} /></div>
              </div>
              <div><Label>Location</Label><Input value={eLoc} onChange={e=>setELoc(e.target.value)} placeholder="Seminar Hall, Block A" /></div>
              <div><Label>Description</Label><Textarea value={eDesc} onChange={e=>setEDesc(e.target.value)} rows={2} /></div>
              <Button onClick={addEv} className="bg-gradient-primary"><Plus className="w-4 h-4 mr-2" />Add event</Button>
            </div>
          )}
          <ul className="space-y-2">
            {evs.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
            {evs.map(e => (
              <li key={e.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{new Date(e.event_date).toLocaleDateString()} {e.location && `· ${e.location}`}</div>
                  {e.description && <div className="text-sm text-muted-foreground mt-1">{e.description}</div>}
                </div>
                {(canEdit && (e.created_by === user?.id || role === "admin")) && (
                  <Button size="icon" variant="ghost" onClick={()=>delEv(e.id)}><Trash2 className="w-4 h-4" /></Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
