import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/request-user";
import { classifyStorageTarget } from "@/lib/storage";
import { createHash } from "crypto";

function toArrayBuffer(file: File) {
  return file.arrayBuffer().then((buffer) => Buffer.from(buffer));
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/?/, "");
}

export async function POST(request: NextRequest) {
  const actor = await getRequestUser(request);
  if (!actor?.profile) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const repoId = String(formData.get("repoId") ?? "").trim();
  const branch = String(formData.get("branch") ?? "main").trim() || "main";
  const sourceLabel = String(formData.get("sourceLabel") ?? "website upload").trim();
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);

  if (!repoId) {
    return NextResponse.json({ error: "repoId is required" }, { status: 400 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: repo, error: repoError } = await admin
    .from("repositories")
    .select("id, owner_id, slug, name, storage_used_bytes, storage_quota_bytes, current_bucket")
    .eq("id", repoId)
    .eq("owner_id", actor.ownerId)
    .maybeSingle();

  if (repoError) {
    return NextResponse.json({ error: repoError.message }, { status: 500 });
  }

  if (!repo) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  const fileEntries = await Promise.all(
    files.map(async (file) => ({
      path: normalizePath(file.webkitRelativePath || file.name),
      size: file.size,
      sha1: createHash("sha1").update(await toArrayBuffer(file)).digest("hex"),
    })),
  );

  const classification = classifyStorageTarget(branch, fileEntries);
  const totalBytes = fileEntries.reduce((sum, file) => sum + file.size, 0);
  const currentRepoBytes = repo.storage_used_bytes ?? 0;
  const currentAccountBytes = actor.profile.storage_used_bytes ?? 0;
  const nextRepoBytes = totalBytes;
  const nextAccountBytes = currentAccountBytes - currentRepoBytes + nextRepoBytes;

  if (nextRepoBytes > (repo.storage_quota_bytes ?? 0)) {
    return NextResponse.json({ error: "Repo would exceed the 5 GB quota." }, { status: 400 });
  }

  if (nextAccountBytes > (actor.profile.storage_quota_bytes ?? 0)) {
    return NextResponse.json({ error: "Account would exceed the 10 GB storage quota." }, { status: 400 });
  }

  const commitMessage = sourceLabel || "Website upload";
  const { data: commit, error: commitError } = await admin
    .from("repository_commits")
    .insert({
      repository_id: repo.id,
      commit_message: commitMessage,
      branch_name: branch,
      tree_sha: classification.bucketName + ":" + Date.now().toString(36),
      archive_key: `${classification.bucketName}/${repo.slug}/${Date.now()}.json`,
      file_count: fileEntries.length,
      total_bytes: totalBytes,
      bucket_name: classification.bucketName,
      asset_class: classification.assetClass,
      metadata: {
        source: "website-upload",
        sourceLabel,
        files: fileEntries,
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
      storage_used_bytes: totalBytes,
      current_bucket: classification.bucketName,
      latest_commit_id: commit.id,
    })
    .eq("id", repo.id);

  if (repoUpdateError) {
    return NextResponse.json({ error: repoUpdateError.message }, { status: 500 });
  }

  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update({ storage_used_bytes: nextAccountBytes })
    .eq("id", actor.ownerId);

  if (profileUpdateError) {
    return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    repository: repo,
    commit,
    bucketName: classification.bucketName,
    assetClass: classification.assetClass,
    fileCount: fileEntries.length,
    totalBytes,
  });
}
