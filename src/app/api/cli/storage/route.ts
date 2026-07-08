import { NextRequest, NextResponse } from "next/server";

import { getCliUser } from "@/lib/cli-auth";
import { buildStorageSummary, getReposForOwner } from "@/lib/repos";

export async function GET(request: NextRequest) {
  const cliUser = await getCliUser(request);
  if (!cliUser?.profile) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const repos = await getReposForOwner(cliUser.ownerId);
  const summary = buildStorageSummary(
    cliUser.profile.storage_used_bytes ?? 0,
    cliUser.profile.storage_quota_bytes ?? 0,
  );

  return NextResponse.json({
    ok: true,
    profile: {
      username: cliUser.profile.username,
      displayName: cliUser.profile.display_name,
    },
    storage: summary,
    repos: repos.map((repo) => ({
      slug: repo.slug,
      name: repo.name,
      usedBytes: repo.storage_used_bytes,
      quotaBytes: repo.storage_quota_bytes,
      bucket: repo.current_bucket,
    })),
  });
}
