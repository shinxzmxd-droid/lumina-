import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public list of faculty (id + name) so a student can pick their assigned faculty during signup.
export const listFacultyPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { data: roles, error: rErr } = await supabaseAdmin
    .from("user_roles").select("user_id").eq("role", "faculty");
  if (rErr) throw new Error(rErr.message);
  const ids = (roles ?? []).map((r) => r.user_id);
  if (ids.length === 0) return { faculty: [] as { user_id: string; full_name: string }[] };
  const { data: profiles, error: pErr } = await supabaseAdmin
    .from("profiles").select("user_id, full_name").in("user_id", ids).eq("approved", true);
  if (pErr) throw new Error(pErr.message);
  return { faculty: (profiles ?? []) as { user_id: string; full_name: string }[] };
});
