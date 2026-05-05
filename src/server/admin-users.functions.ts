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
      user_metadata: {
        full_name: data.fullName,
        role: data.role,
        created_by_admin: true,
      },
    });
    if (error) throw new Error(error.message);
    return { ok: true, userId: created.user?.id };
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

      const { error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: name, role: "faculty", created_by_admin: true },
      });
      if (error) {
        skipped.push({ name, reason: error.message });
      } else {
        created.push({ name, email });
      }
    }
    return { created, skipped, password: data.password };
  });
