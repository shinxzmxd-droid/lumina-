import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BookOpen, Plus, Upload } from "lucide-react";

export const Route = createFileRoute("/courses")({
  component: () => <RequireAuth><Page /></RequireAuth>,
});

function Page() {
  const { user, role } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [newCode, setNewCode] = useState(""); const [newName, setNewName] = useState("");
  const [matCourse, setMatCourse] = useState<any>(null);
  const [matTitle, setMatTitle] = useState(""); const [matContent, setMatContent] = useState("");
  const [matFile, setMatFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (role === "student") {
      const { data } = await supabase.from("enrollments").select("course_id, courses(*)").eq("student_id", user!.id);
      setCourses((data ?? []).map((e: any) => e.courses));
    } else if (role === "faculty") {
      const { data } = await supabase.from("courses").select("*").eq("faculty_id", user!.id);
      setCourses(data ?? []);
    } else {
      const { data } = await supabase.from("courses").select("*");
      setCourses(data ?? []);
    }
  };
  useEffect(() => { if (user && role) load(); }, [user, role]);

  const createCourse = async () => {
    if (!newCode || !newName) return;
    const { error } = await supabase.from("courses").insert({ code: newCode, name: newName, faculty_id: user!.id });
    if (error) return toast.error(error.message);
    toast.success("Course created"); setNewCode(""); setNewName(""); load();
  };

  const enroll = async (cid: string) => {
    const { error } = await supabase.from("enrollments").insert({ course_id: cid, student_id: user!.id });
    if (error) return toast.error(error.message);
    toast.success("Enrolled"); load();
  };

  const uploadMaterial = async () => {
    if (!matCourse || !matTitle) return toast.error("Title required");
    if (!matContent && !matFile) return toast.error("Add notes text or attach a PDF");
    setUploading(true);
    try {
      let file_url: string | null = null;
      if (matFile) {
        const path = `${matCourse.id}/${Date.now()}-${matFile.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
        const { error: upErr } = await supabase.storage.from("course-materials").upload(path, matFile, {
          contentType: matFile.type || "application/pdf",
        });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("course-materials").getPublicUrl(path);
        file_url = data.publicUrl;
      }
      const { error } = await supabase.from("course_materials").insert({
        course_id: matCourse.id, title: matTitle, content: matContent || null, file_url, uploaded_by: user!.id,
      });
      if (error) throw error;
      toast.success("Material uploaded");
      setMatTitle(""); setMatContent(""); setMatFile(null); setMatCourse(null);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-display">{role === "student" ? "My courses" : "Courses"}</h1>
        {role !== "student" && (
          <Dialog>
            <DialogTrigger asChild><Button className="bg-gradient-primary"><Plus className="w-4 h-4 mr-2" />New course</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create course</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Code</Label><Input value={newCode} onChange={e=>setNewCode(e.target.value)} placeholder="CS101" /></div>
                <div><Label>Name</Label><Input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Intro to Computer Science" /></div>
                <Button onClick={createCourse} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {role === "student" && <BrowseAll onEnroll={enroll} mineIds={courses.map(c=>c?.id)} />}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map(c => c && (
          <Card key={c.id} className="p-5 shadow-elegant hover:shadow-glow transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary grid place-items-center"><BookOpen className="w-5 h-5 text-primary-foreground" /></div>
              <span className="text-xs text-muted-foreground">{c.code}</span>
            </div>
            <h3 className="font-display font-semibold mb-1">{c.name}</h3>
            {c.description && <p className="text-sm text-muted-foreground mb-3">{c.description}</p>}
            {role === "faculty" && (
              <Button size="sm" variant="outline" className="w-full" onClick={()=>setMatCourse(c)}>
                <Upload className="w-3 h-3 mr-2" /> Add material
              </Button>
            )}
          </Card>
        ))}
        {courses.length === 0 && <p className="text-muted-foreground col-span-full text-center py-12">No courses yet.</p>}
      </div>

      <Dialog open={!!matCourse} onOpenChange={(o)=>!o && setMatCourse(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload material — {matCourse?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={matTitle} onChange={e=>setMatTitle(e.target.value)} placeholder="Chapter 1: Introduction" /></div>
            <div><Label>Content / syllabus text</Label><Textarea rows={10} value={matContent} onChange={e=>setMatContent(e.target.value)} placeholder="Paste lecture notes, syllabus, or readings here. The AI tutor will ground answers in this." /></div>
            <Button onClick={uploadMaterial} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BrowseAll({ onEnroll, mineIds }: { onEnroll: (id: string) => void; mineIds: string[] }) {
  const [all, setAll] = useState<any[]>([]);
  useEffect(() => { supabase.from("courses").select("*").then(({data}) => setAll(data ?? [])); }, []);
  const available = all.filter(c => !mineIds.includes(c.id));
  if (available.length === 0) return null;
  return (
    <Card className="p-5">
      <h3 className="font-display font-semibold mb-3">Available courses</h3>
      <div className="flex flex-wrap gap-2">
        {available.map(c => (
          <Button key={c.id} size="sm" variant="outline" onClick={()=>onEnroll(c.id)}>+ {c.code} {c.name}</Button>
        ))}
      </div>
    </Card>
  );
}
