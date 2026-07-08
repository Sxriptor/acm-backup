import { NextResponse } from "next/server";

import { getViewer } from "@/lib/auth";
import { syncDiscoveredRepos } from "@/lib/repos";
import { discoverWorkRepos } from "@/lib/work";

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const repos = await discoverWorkRepos();
  const synced = await syncDiscoveredRepos(viewer.id, repos);

  return NextResponse.json({ ok: true, count: synced.length, repos: synced });
}
