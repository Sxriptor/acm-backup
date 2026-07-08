import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getViewer } from "@/lib/auth";
import { discoverWorkRepos } from "@/lib/work";
import { getSiteUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfileByUsername, getReposForOwner, syncDiscoveredRepos } from "@/lib/repos";

export default async function UserPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const ownerProfile = profile;
  const viewer = await getViewer().catch(() => null);
  const isOwner = viewer?.id === ownerProfile.id;

  async function syncWork() {
    "use server";

    const currentViewer = await getViewer();
    if (!currentViewer || currentViewer.id !== ownerProfile.id) {
      redirect("/login");
    }

    const repos = await discoverWorkRepos();
    await syncDiscoveredRepos(ownerProfile.id, repos);
    redirect(`/u/${ownerProfile.username}`);
  }

  async function logout() {
    "use server";

    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/");
  }

  const repos = await getReposForOwner(ownerProfile.id);

  return (
    <main className="page">
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">A</span>
            <span>ACM Hub</span>
          </div>
          <div className="actions">
            <Link className="ghost-button" href="/">
              Landing page
            </Link>
            {isOwner ? (
              <form action={logout}>
                <button className="secondary-button" type="submit">
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </header>

        <section className="page-header">
          <div>
            <div className="meta-label">Owner</div>
            <h1 className="page-title">{ownerProfile.display_name || ownerProfile.username}</h1>
            <p className="muted">
              `work` folder backups for <span className="mono">{ownerProfile.username}</span>. Each repo gets a remote
              URL in the shape <span className="mono">{getSiteUrl()}/{ownerProfile.username}/repo-name.acm</span>.
            </p>
          </div>
          {isOwner ? (
            <div className="toolbar">
              <form action={syncWork}>
                <button className="primary-button" type="submit">
                  Sync from work folder
                </button>
              </form>
            </div>
          ) : null}
        </section>

        {repos.length === 0 ? (
          <section className="panel detail-stack">
            <div className="warning">
              No repos are registered yet. Use the sync button to import every top-level folder from the configured work root.
            </div>
            <div className="code-block">ACM_WORK_ROOT=C:/anglertools/work</div>
          </section>
        ) : (
          <section className="repo-grid">
            {repos.map((repo) => (
              <Link key={repo.id} href={`/u/${ownerProfile.username}/${repo.slug}`} className="repo-card">
                <div className="repo-badge">{repo.visibility}</div>
                <h3>{repo.name}</h3>
                <p className="repo-meta">{repo.description || "No description yet. This was imported from the local work folder or first push."}</p>
                <div className="inline-code-pill">{getSiteUrl()}/{ownerProfile.username}/{repo.slug}.acm</div>
                <p className="caption">Source: {repo.source_path || "CLI-managed only"}</p>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
