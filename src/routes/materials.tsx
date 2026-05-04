import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, BookOpen } from "lucide-react";

export const Route = createFileRoute("/materials")({
  component: () => <RequireAuth roles={["student"]}><Page /></RequireAuth>,
});

function Page() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<{ course: any; items: any[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: en } = await supabase
        .from("enrollments")
        .select("course_id, courses(id, code, name)")
        .eq("student_id", user.id);
      const courseIds = (en ?? []).map((e: any) => e.course_id);
      if (courseIds.length === 0) { setGroups([]); setLoading(false); return; }
      const { data: mats } = await supabase
        .from("course_materials")
        .select("*")
        .in("course_id", courseIds)
        .order("created_at", { ascending: false });
      const byCourse: Record<string, any[]> = {};
      (mats ?? []).forEach((m: any) => { (byCourse[m.course_id] ||= []).push(m); });
      setGroups((en ?? []).map((e: any) => ({
        course: e.courses,
        items: byCourse[e.course_id] ?? [],
      })));
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Course materials</h1>
        <p className="text-muted-foreground">PDFs and notes shared by your faculty.</p>
      </div>

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {!loading && groups.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">Enroll in courses to see materials.</Card>
      )}

      {groups.map(g => g.course && (
        <Card key={g.course.id} className="p-5 shadow-elegant">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary grid place-items-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-display font-semibold">{g.course.name}</h2>
              <span className="text-xs text-muted-foreground">{g.course.code}</span>
            </div>
            <Badge variant="outline" className="ml-auto">{g.items.length} item(s)</Badge>
          </div>
          {g.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No materials uploaded yet.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {g.items.map(m => (
                <div key={m.id} className="border rounded-lg p-4 hover:shadow-elegant transition-shadow">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-accent mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{m.title}</h3>
                      {m.content && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{m.content}</p>}
                      <div className="mt-2 flex gap-2">
                        {m.file_url && (
                          <Button asChild size="sm" variant="outline">
                            <a href={m.file_url} target="_blank" rel="noopener noreferrer">
                              <Download className="w-3 h-3 mr-1" /> Open PDF
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
