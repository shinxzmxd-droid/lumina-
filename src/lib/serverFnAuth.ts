import { supabase } from "@/integrations/supabase/client";

/**
 * Wraps a server function bound via useServerFn so that the current Supabase
 * access token is sent as an `Authorization: Bearer …` header. Required for
 * any server fn that uses the `requireSupabaseAuth` middleware.
 */
export function withAuthHeaders<TArgs extends { headers?: HeadersInit } | undefined, TRet>(
  fn: (opts?: TArgs) => Promise<TRet>
) {
  return async (opts?: TArgs): Promise<TRet> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers: Record<string, string> = {
      ...((opts as any)?.headers ?? {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fn({ ...(opts as any), headers } as TArgs);
  };
}
