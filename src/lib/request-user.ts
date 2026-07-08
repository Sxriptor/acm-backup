import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";
import { getCliUser } from "@/lib/cli-auth";

export async function getRequestUser(request: NextRequest) {
  const cliUser = await getCliUser(request);
  if (cliUser?.profile) {
    return {
      ownerId: cliUser.ownerId,
      profile: cliUser.profile,
      source: "cli" as const,
    };
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value }));
      },
      setAll() {
        // Route handlers do not persist auth cookies here.
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, storage_used_bytes, storage_quota_bytes")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  return {
    ownerId: profile.id,
    profile,
    source: "web" as const,
  };
}
