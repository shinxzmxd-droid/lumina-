import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(72),
      fullName: z.string().min(1).max(120),
      role: z.enum(["student", "faculty", "admin"]),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden: admins only");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) throw new Error(error.message);
    const newUserId = created.user?.id;
    if (newUserId) {
      // Trigger creates a default student row + unapproved profile.
      // Server-side: set the requested role and mark approved (admin-created).
      if (data.role !== "student") {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
        await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: data.role });
      }
      await supabaseAdmin.from("profiles").update({ approved: true }).eq("user_id", newUserId);
    }
    return { ok: true, userId: newUserId };
  });

export const adminSetApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      userId: z.string().uuid(),
      approved: z.boolean(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden: admins only");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ approved: data.approved })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function slugifyEmail(name: string) {
  return name
    .replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, ".");
}

export const adminSeedFaculty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    names: z.array(z.string().min(1)).min(1).max(50),
    password: z.string().min(8).max(72).default("Lumina@123"),
    domain: z.string().min(3).default("lumina.edu"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) throw new Error("Forbidden: admins only");

    const created: { name: string; email: string }[] = [];
    const skipped: { name: string; reason: string }[] = [];
    const seen = new Set<string>();

    for (const rawName of data.names) {
      const name = rawName.trim();
      if (!name) continue;
      const local = slugifyEmail(name);
      const email = `${local}@${data.domain}`;
      if (seen.has(email)) { skipped.push({ name, reason: "duplicate" }); continue; }
      seen.add(email);

      const { data: createdUser, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (error) {
        skipped.push({ name, reason: error.message });
      } else {
        const uid = createdUser.user?.id;
        if (uid) {
          await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
          await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "faculty" });
          await supabaseAdmin.from("profiles").update({ approved: true }).eq("user_id", uid);
        }
        created.push({ name, email });
      }
    }
    return { created, skipped, password: data.password };
  });
