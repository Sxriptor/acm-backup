import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCliUser } from "@/lib/cli-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildStorageSummary } from "@/lib/repos";
import { MAX_ACCOUNT_STORAGE_BYTES, MAX_REPO_STORAGE_BYTES, storeArchiveIfConfigured } from "@/lib/storage";

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
  const cliUser = await getCliUser(request);
  if (!cliUser?.profile) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const payload = parsed.data;

  if (cliUser.profile.username !== payload.ownerUsername) {
    return NextResponse.json({ error: "remote owner does not match the logged-in CLI account" }, { status: 403 });
  }

  const { data: repo, error: repoError } = await admin
    .from("repositories")
    .upsert(
      {
        owner_id: cliUser.ownerId,
        slug: payload.repoSlug,
        name: payload.repoName,
        source_path: payload.sourcePath ?? null,
        description: `Last pushed from ${payload.sourcePath ?? "CLI workspace"}`,
        visibility: "private",
      },
      { onConflict: "owner_id,slug" },
    )
    .select("id, slug, name, storage_used_bytes, storage_quota_bytes")
    .single();

  if (repoError) {
    return NextResponse.json({ error: repoError.message }, { status: 500 });
  }

  let archive;
  try {
    archive = await storeArchiveIfConfigured(payload.repoSlug, payload.branch, payload);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }

  const currentRepoBytes = repo.storage_used_bytes ?? 0;
  const currentAccountBytes = cliUser.profile.storage_used_bytes ?? 0;
  const nextRepoBytes = archive.totalBytes;
  const nextAccountBytes = currentAccountBytes - currentRepoBytes + nextRepoBytes;

  if (nextRepoBytes > (repo.storage_quota_bytes ?? MAX_REPO_STORAGE_BYTES)) {
    return NextResponse.json({ error: "Repo would exceed the 5 GB quota." }, { status: 400 });
  }

  if (nextAccountBytes > (cliUser.profile.storage_quota_bytes ?? MAX_ACCOUNT_STORAGE_BYTES)) {
    return NextResponse.json({ error: "Account would exceed the 10 GB storage quota." }, { status: 400 });
  }

  const { data: commit, error: commitError } = await admin
    .from("repository_commits")
    .insert({
      repository_id: repo.id,
      commit_message: payload.message,
      branch_name: payload.branch,
      tree_sha: payload.treeSha,
      archive_key: archive.archiveKey,
      file_count: payload.files.length,
      total_bytes: archive.totalBytes,
      bucket_name: archive.bucketName,
      asset_class: archive.assetClass,
      metadata: {
        remoteUrl: payload.remoteUrl,
        sourcePath: payload.sourcePath ?? null,
        files: payload.files,
        largestFileBytes: archive.largestFileBytes,
      },
    })
    .select("id, created_at")
    .single();

  if (commitError) {
    return NextResponse.json({ error: commitError.message }, { status: 500 });
  }

  const { error: repoUpdateError } = await admin
    .from("repositories")
    .update({
      storage_used_bytes: archive.totalBytes,
      current_bucket: archive.bucketName,
      latest_commit_id: commit.id,
    })
    .eq("id", repo.id);

  if (repoUpdateError) {
    return NextResponse.json({ error: repoUpdateError.message }, { status: 500 });
  }

  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update({
      storage_used_bytes: nextAccountBytes,
    })
    .eq("id", cliUser.ownerId);

  if (profileUpdateError) {
    return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    repository: repo,
    commit,
    archiveStored: archive.stored,
    archiveKey: archive.archiveKey,
    bucketName: archive.bucketName,
    assetClass: archive.assetClass,
    storage: buildStorageSummary(nextAccountBytes, cliUser.profile.storage_quota_bytes ?? MAX_ACCOUNT_STORAGE_BYTES),
  });
}
