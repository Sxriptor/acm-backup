import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCliUser } from "@/lib/cli-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { storeArchiveIfConfigured } from "@/lib/storage";

const schema = z.object({
  ownerUsername: z.string().min(1),
  repoSlug: z.string().min(1),
  repoName: z.string().min(1),
  branch: z.string().min(1),
  message: z.string().min(1),
  treeSha: z.string().min(8),
  files: z.array(
    z.object({
      path: z.string(),
      size: z.number().int().nonnegative(),
      sha1: z.string(),
    }),
  ),
  remoteUrl: z.string().url(),
  sourcePath: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCliUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const payload = parsed.data;
  const { data: profile } = await admin
    .from("profiles")
    .select("id, username")
    .eq("id", user.id)
    .eq("username", payload.ownerUsername)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "remote owner does not match the signed-in user" }, { status: 403 });
  }

  const { data: repo, error: repoError } = await admin
    .from("repositories")
    .upsert(
      {
        owner_id: user.id,
        slug: payload.repoSlug,
        name: payload.repoName,
        source_path: payload.sourcePath ?? null,
        description: `Last pushed from ${payload.sourcePath ?? "CLI workspace"}`,
        visibility: "private",
      },
      { onConflict: "owner_id,slug" },
    )
    .select("id, slug, name")
    .single();

  if (repoError) {
    return NextResponse.json({ error: repoError.message }, { status: 500 });
  }

  const archive = await storeArchiveIfConfigured(payload.repoSlug, payload);
  const { data: commit, error: commitError } = await admin
    .from("repository_commits")
    .insert({
      repository_id: repo.id,
      commit_message: payload.message,
      branch_name: payload.branch,
      tree_sha: payload.treeSha,
      archive_key: archive.archiveKey,
      file_count: payload.files.length,
      metadata: {
        remoteUrl: payload.remoteUrl,
        sourcePath: payload.sourcePath ?? null,
        files: payload.files,
      },
    })
    .select("id, created_at")
    .single();

  if (commitError) {
    return NextResponse.json({ error: commitError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    repository: repo,
    commit,
    archiveStored: archive.stored,
    archiveKey: archive.archiveKey,
  });
}
