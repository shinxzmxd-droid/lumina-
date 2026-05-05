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
