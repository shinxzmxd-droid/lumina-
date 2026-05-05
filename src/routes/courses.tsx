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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BookOpen, Plus, Upload, FileText, Pencil, Trash2, Download, Eye } from "lucide-react";

export const Route = createFileRoute("/courses")({
  component: () => <RequireAuth><Page /></RequireAuth>,
});

function Page() {
  const { user, role } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [newCode, setNewCode] = useState(""); const [newName, setNewName] = useState("");
  const [classGroups, setClassGroups] = useState<any[]>([]);
  const [newSemester, setNewSemester] = useState<string>("any");
  const [newClassId, setNewClassId] = useState<string>("none");
  const [createOpen, setCreateOpen] = useState(false);
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
      const { data: g } = await supabase.from("class_groups").select("*").eq("faculty_id", user!.id).order("created_at", { ascending: false });
      setClassGroups(g ?? []);
    } else {
      const { data } = await supabase.from("courses").select("*");
      setCourses(data ?? []);
    }
  };
  useEffect(() => { if (user && role) load(); }, [user, role]);

  const createCourse = async () => {
    if (!newCode || !newName) return;
    const { data: created, error } = await supabase.from("courses")
      .insert({ code: newCode, name: newName, faculty_id: user!.id })
      .select("id").single();
    if (error) return toast.error(error.message);

    let enrolled = 0;
    if (newClassId && newClassId !== "none" && created) {
      const { data: members } = await supabase.from("class_group_members")
        .select("student_id").eq("class_group_id", newClassId);
      const rows = (members ?? []).map((m: any) => ({ course_id: created.id, student_id: m.student_id }));
      if (rows.length) {
        const { error: enErr } = await supabase.from("enrollments").insert(rows);
        if (enErr) toast.error(`Course created, but enrollment failed: ${enErr.message}`);
        else enrolled = rows.length;
      }
    }
    toast.success(enrolled ? `Course created · ${enrolled} students enrolled` : "Course created");
    setNewCode(""); setNewName(""); setNewClassId("none"); setNewSemester("any"); setCreateOpen(false); load();
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
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-primary"><Plus className="w-4 h-4 mr-2" />New course</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create course</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Code</Label><Input value={newCode} onChange={e=>setNewCode(e.target.value)} placeholder="CS101" /></div>
                <div><Label>Name</Label><Input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Intro to Computer Science" /></div>
                {role === "faculty" && (
                  <>
                    <div>
                      <Label>Semester</Label>
                      <Select value={newSemester} onValueChange={(v) => { setNewSemester(v); setNewClassId("none"); }}>
                        <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any semester</SelectItem>
                          {["1st Semester","2nd Semester","3rd Semester","4th Semester","5th Semester","6th Semester","7th Semester","8th Semester"].map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Assign to class (optional)</Label>
                      <Select value={newClassId} onValueChange={setNewClassId}>
                        <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No class — just create</SelectItem>
                          {classGroups
                            .filter(g => newSemester === "any" || g.semester === newSemester)
                            .map(g => (
                              <SelectItem key={g.id} value={g.id}>{g.name} · {g.semester}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">All students in the chosen class will be auto-enrolled.</p>
                    </div>
                  </>
                )}
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
              <div className="space-y-2">
                <Button size="sm" variant="outline" className="w-full" onClick={()=>setMatCourse(c)}>
                  <Upload className="w-3 h-3 mr-2" /> Add material
                </Button>
                <FacultyMaterials courseId={c.id} />
              </div>
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
            <div>
              <Label>Attach PDF (optional)</Label>
              <Input type="file" accept="application/pdf,.pdf" onChange={e=>setMatFile(e.target.files?.[0] ?? null)} />
              {matFile && <p className="text-xs text-muted-foreground mt-1">{matFile.name} ({Math.round(matFile.size/1024)} KB)</p>}
            </div>
            <div><Label>Notes / syllabus text (optional)</Label><Textarea rows={6} value={matContent} onChange={e=>setMatContent(e.target.value)} placeholder="Paste lecture notes — the AI tutor uses this to ground answers." /></div>
            <Button onClick={uploadMaterial} disabled={uploading} className="w-full">{uploading ? "Uploading…" : "Save"}</Button>
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

function FacultyMaterials({ courseId }: { courseId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [eTitle, setETitle] = useState("");
  const [eContent, setEContent] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("course_materials")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { if (open) load(); }, [open, courseId]);

  const startEdit = (m: any) => { setEditing(m); setETitle(m.title); setEContent(m.content ?? ""); };
  const saveEdit = async () => {
    const { error } = await supabase.from("course_materials")
      .update({ title: eTitle, content: eContent || null })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Updated"); setEditing(null); load();
  };
  const remove = async (m: any) => {
    if (!confirm(`Delete "${m.title}"?`)) return;
    const { error } = await supabase.from("course_materials").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  const fileUrl = (m: any) => {
    if (!m.file_url) return null;
    return m.file_url.startsWith("http")
      ? m.file_url
      : supabase.storage.from("course-materials").getPublicUrl(m.file_url).data.publicUrl;
  };

  return (
    <>
      <Button size="sm" variant="ghost" className="w-full" onClick={() => setOpen(true)}>
        <Eye className="w-3 h-3 mr-2" /> View materials
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Course materials</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {items.length === 0 && <p className="text-sm text-muted-foreground">No materials yet.</p>}
            {items.map(m => {
              const url = fileUrl(m);
              return (
                <div key={m.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-start gap-3">
                  <FileText className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{m.title}</div>
                    {m.content && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{m.content}</p>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={url} target="_blank" rel="noopener noreferrer"><Download className="w-3 h-3 mr-1" />Open</a>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => startEdit(m)}><Pencil className="w-3 h-3" /></Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(m)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit material</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={eTitle} onChange={e => setETitle(e.target.value)} /></div>
            <div><Label>Notes</Label><Textarea rows={6} value={eContent} onChange={e => setEContent(e.target.value)} /></div>
            <Button onClick={saveEdit} className="w-full">Save changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
