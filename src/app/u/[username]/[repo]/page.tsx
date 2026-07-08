import Link from "next/link";
import { notFound } from "next/navigation";

import { getSiteUrl } from "@/lib/env";
import { getLatestCommits, getProfileByUsername, getRepoByOwnerAndSlug } from "@/lib/repos";
import { formatBytes } from "@/lib/storage";

export default async function RepoPage({
  params,
}: {
  params: Promise<{ username: string; repo: string }>;
}) {
  const { username, repo } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const repository = await getRepoByOwnerAndSlug(profile.id, repo);
  if (!repository) {
    notFound();
  }

  const commits = await getLatestCommits(repository.id);
  const cloneUrl = `${getSiteUrl()}/${profile.username}/${repository.slug}.acm`;

  return (
    <main className="page">
      <div className="shell panel-stack">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">A</span>
            <span>ACM Hub</span>
          </div>
          <div className="actions">
            <Link className="ghost-button" href={`/u/${profile.username}`}>
              Back to repos
            </Link>
          </div>
        </header>

        <section className="page-header">
          <div>
            <div className="meta-label">Repository</div>
            <h1 className="page-title">{repository.name}</h1>
            <p className="muted">{repository.description || "This repo was created from a local work folder sync or on first CLI push."}</p>
          </div>
        </section>

        <section className="repo-grid">
          <article className="panel detail-stack">
            <div className="meta-label">Clone / remote URL</div>
            <div className="code-block">{cloneUrl}</div>
            <div className="caption mono">acm remote add origin {cloneUrl}</div>
          </article>
          <article className="panel detail-stack">
            <div className="meta-label">Storage</div>
            <div className="code-block">Used {formatBytes(repository.storage_used_bytes)} of {formatBytes(repository.storage_quota_bytes)}{"\n"}Bucket {repository.current_bucket || "not assigned yet"}</div>
            <div className="caption">Per-repo max is 5 GB. Files over 300 MB route to the LFA bucket. Single files over 2 GB are rejected.</div>
          </article>
          <article className="panel detail-stack">
            <div className="meta-label">Local source path</div>
            <div className="inline-code-pill">{repository.source_path || "Not linked yet"}</div>
            <div className="caption">If this repo came from the CLI first, the path stays empty until you sync from the work folder or store it in metadata.</div>
          </article>
        </section>

        <section className="panel detail-stack">
          <div className="meta-label">CLI flow</div>
          <div className="code-block">acm login{"\n"}acm init .{"\n"}acm add .{"\n"}acm commit -m &quot;backup snapshot&quot;{"\n"}acm push origin main{"\n"}acm storage</div>
        </section>

        <section className="panel detail-stack">
          <div className="meta-label">Recent commits</div>
          {commits.length === 0 ? (
            <div className="warning">No pushes yet. The repo record exists, but no commit manifest has been uploaded.</div>
          ) : (
            <div className="commit-grid">
              {commits.map((commit) => (
                <article key={commit.id} className="commit-card">
                  <h3>{commit.commit_message}</h3>
                  <p className="commit-meta mono">{commit.tree_sha}</p>
                  <ul className="list">
                    <li>
                      <span>Branch</span>
                      <span className="mono">{commit.branch_name}</span>
                    </li>
                    <li>
                      <span>Files</span>
                      <span>{commit.file_count}</span>
                    </li>
                    <li>
                      <span>Snapshot size</span>
                      <span>{formatBytes(commit.total_bytes)}</span>
                    </li>
                    <li>
                      <span>Bucket</span>
                      <span className="mono">{commit.bucket_name || "not stored yet"}</span>
                    </li>
                    <li>
                      <span>Class</span>
                      <span className="mono">{commit.asset_class}</span>
                    </li>
                    <li>
                      <span>Pushed</span>
                      <span>{new Date(commit.created_at).toLocaleString()}</span>
                    </li>
                  </ul>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
