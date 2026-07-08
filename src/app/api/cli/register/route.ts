import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCliUser } from "@/lib/cli-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  ownerUsername: z.string().min(1),
  repoSlug: z.string().min(1),
  repoName: z.string().min(1),
  remoteUrl: z.string().url().optional(),
  sourcePath: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const cliUser = await getCliUser(request);
  if (!cliUser?.profile) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { ownerUsername, repoSlug, repoName, remoteUrl, sourcePath } = parsed.data;

  if (cliUser.profile.username !== ownerUsername) {
    return NextResponse.json({ error: "remote owner does not match the logged-in CLI account" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("repositories")
    .upsert(
      {
        owner_id: cliUser.ownerId,
        slug: repoSlug,
        name: repoName,
        source_path: sourcePath ?? null,
        description: remoteUrl ? `Registered by CLI for ${remoteUrl}` : null,
        visibility: "private",
      },
      { onConflict: "owner_id,slug" },
    )
    .select("id, slug, name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, repository: data });
}
