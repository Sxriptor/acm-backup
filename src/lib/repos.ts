import { cache } from "react";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CommitRecord, RepoRecord, StorageSummary, WorkRepo } from "@/lib/types";
import { computeRemainingStorage } from "@/lib/storage";

export async function requireViewer() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export const getProfileByUsername = cache(async (username: string) => {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, username, display_name, storage_used_bytes, storage_quota_bytes")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
});

export async function getReposForOwner(ownerId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("repositories")
    .select("id, owner_id, slug, name, description, source_path, storage_used_bytes, storage_quota_bytes, current_bucket, created_at, updated_at, visibility")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as RepoRecord[];
}

export async function getRepoByOwnerAndSlug(ownerId: string, slug: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("repositories")
    .select("id, owner_id, slug, name, description, source_path, storage_used_bytes, storage_quota_bytes, current_bucket, created_at, updated_at, visibility")
    .eq("owner_id", ownerId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as RepoRecord | null;
}

export async function getLatestCommits(repositoryId: string, limit = 12) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("repository_commits")
    .select("id, repository_id, commit_message, branch_name, tree_sha, archive_key, file_count, total_bytes, bucket_name, asset_class, created_at, metadata")
    .eq("repository_id", repositoryId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as CommitRecord[];
}

export async function syncDiscoveredRepos(ownerId: string, repos: WorkRepo[]) {
  const admin = createSupabaseAdminClient();
  const payload = repos.map((repo) => ({
    owner_id: ownerId,
    slug: repo.slug,
    name: repo.name,
    description: repo.description,
    source_path: repo.sourcePath,
    visibility: "private",
  }));

  if (payload.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from("repositories")
    .upsert(payload, { onConflict: "owner_id,slug" })
    .select("id, owner_id, slug, name, description, source_path, storage_used_bytes, storage_quota_bytes, current_bucket, created_at, updated_at, visibility");

  if (error) {
    throw error;
  }

  return (data ?? []) as RepoRecord[];
}

export function buildStorageSummary(usedBytes: number, quotaBytes: number): StorageSummary {
  return {
    usedBytes,
    quotaBytes,
    remainingBytes: computeRemainingStorage(usedBytes, quotaBytes),
  };
}
