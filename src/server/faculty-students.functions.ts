import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertFaculty(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => r.role === "faculty");
  if (!ok) throw new Error("Forbidden: faculty only");
}

export const facultyApproveStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid(), approved: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    // verify the student is assigned to this faculty
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("assigned_faculty_id")
      .eq("user_id", data.studentId).maybeSingle();
    if (!prof || prof.assigned_faculty_id !== context.userId) {
      throw new Error("This student is not assigned to you");
    }
    const { error } = await supabaseAdmin
      .from("profiles").update({ approved: data.approved }).eq("user_id", data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertFaculty(context.userId);
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, approved, created_at")
      .eq("assigned_faculty_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { students: data ?? [] };
  });

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const bulkAddStudentsByName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    classGroupId: z.string().uuid(),
    names: z.array(z.string()).min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    // verify class belongs to faculty
    const { data: grp } = await supabaseAdmin
      .from("class_groups").select("id, faculty_id").eq("id", data.classGroupId).maybeSingle();
    if (!grp || grp.faculty_id !== context.userId) throw new Error("Class not found");

    // get all student profiles
    const { data: studentRoles } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "student");
    const studentIds = (studentRoles ?? []).map((r: any) => r.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("user_id, full_name, assigned_faculty_id, approved")
      .in("user_id", studentIds);

    // existing members
    const { data: existing } = await supabaseAdmin
      .from("class_group_members").select("student_id").eq("class_group_id", data.classGroupId);
    const existingIds = new Set((existing ?? []).map((m: any) => m.student_id));

    const matched: { id: string; name: string }[] = [];
    const unmatched: string[] = [];
    const updates: string[] = []; // ids to assign + approve

    for (const raw of data.names) {
      const nn = norm(raw);
      if (!nn) continue;
      const hit = (profiles ?? []).find((p: any) => {
        const sn = norm(p.full_name ?? "");
        return sn && (sn === nn || sn.includes(nn) || nn.includes(sn));
      });
      if (hit && !existingIds.has(hit.user_id) && !matched.some(m => m.id === hit.user_id)) {
        matched.push({ id: hit.user_id, name: hit.full_name });
        if (hit.assigned_faculty_id !== context.userId || !hit.approved) updates.push(hit.user_id);
      } else if (!hit) unmatched.push(raw);
    }

    if (updates.length) {
      await supabaseAdmin.from("profiles")
        .update({ assigned_faculty_id: context.userId, approved: true })
        .in("user_id", updates);
    }
    if (matched.length) {
      const rows = matched.map(m => ({ class_group_id: data.classGroupId, student_id: m.id }));
      const { error } = await supabaseAdmin.from("class_group_members").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { added: matched.length, unmatched };
  });
