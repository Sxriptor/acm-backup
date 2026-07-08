import Link from "next/link";

import { getViewer } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";

export default async function HomePage() {
  const viewer = hasSupabaseEnv() ? await getViewer().catch(() => null) : null;
  const dashboardHref = viewer?.username ? `/u/${viewer.username}` : "/login";

  return (
    <main className="hero">
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">A</span>
            <span>ACM Hub</span>
          </div>
          <nav className="nav-links">
            <a className="nav-link" href="#repos">Repos</a>
            <a className="nav-link" href="#cli">CLI</a>
            <a className="nav-link" href="#stack">Stack</a>
          </nav>
          <div className="actions">
            <Link className="ghost-button" href="/signup">
              Create account
            </Link>
            <Link className="primary-button" href={dashboardHref}>
              {viewer ? "Open dashboard" : "Sign in"}
            </Link>
          </div>
        </header>

        <section className="hero-grid">
          <div className="hero-copy">
            <div className="hero-kicker">GitHub-style backup for your work folder</div>
            <h1>Track every top-level folder in `work` like its own repo.</h1>
            <p>
              ACM Hub is a simplified GitHub clone for your local mod and tooling directories.
              Supabase handles password auth on the website. The CLI now authorizes through the
              browser, not through terminal passwords. Each top-level `work/*` folder can become a
              repo with a `.acm` remote, commit history, and storage limits.
            </p>
            {!hasSupabaseEnv() ? (
              <div className="warning">
                Supabase env vars are not configured yet. Use `.env.example`, run the SQL migrations,
                then come back to sign in.
              </div>
            ) : null}
            <div className="hero-stats">
              <div className="stat">
                <strong>10 GB</strong>
                <span className="caption">max storage per account</span>
              </div>
              <div className="stat">
                <strong>5 GB</strong>
                <span className="caption">max snapshot size per repo</span>
              </div>
              <div className="stat">
                <strong>300 MB+</strong>
                <span className="caption">routes files to the `LFA` bucket</span>
              </div>
            </div>
          </div>

          <div className="hero-panel panel-stack">
            <div>
              <div className="meta-label">Clone URL pattern</div>
              <div className="code-block">https://acmhub.netlify.app/sxriptor/unlimited-rod-holders.acm</div>
            </div>
            <div>
              <div className="meta-label">CLI flow</div>
              <div className="code-block">acm login{"\n"}acm init .{"\n"}acm add .{"\n"}acm commit -m &quot;first backup&quot;{"\n"}acm push origin main{"\n"}acm storage</div>
            </div>
            <div>
              <div className="meta-label">Buckets</div>
              <div className="caption">
                `repos` for normal snapshots, `releases` for release branches, and `LFA` for files at
                or above 300 MB. Single files over 2 GB are rejected.
              </div>
            </div>
          </div>
        </section>

        <section id="repos" className="page">
          <div className="page-header">
            <div>
              <div className="meta-label">Repos</div>
              <h2 className="page-title">A repo catalog shaped by your actual workspace.</h2>
            </div>
          </div>
          <div className="repo-grid">
            <article className="repo-card">
              <div className="repo-badge">Scan</div>
              <h3>Sync `work/*` into repo records</h3>
              <p className="repo-meta">
                The dashboard can import every top-level directory under the configured work root.
              </p>
            </article>
            <article className="repo-card">
              <div className="repo-badge">Browse</div>
              <h3>Open a repo page per folder</h3>
              <p className="repo-meta">
                Each repo page exposes the `.acm` clone URL, current bucket, storage usage, and recent commits.
              </p>
            </article>
            <article className="repo-card">
              <div className="repo-badge">Quota</div>
              <h3>See storage left on the account</h3>
              <p className="repo-meta">
                The website and the terminal `acm storage` command both report remaining storage.
              </p>
            </article>
          </div>
        </section>

        <section id="cli" className="page">
          <div className="page-header">
            <div>
              <div className="meta-label">CLI</div>
              <h2 className="page-title">Thin git-style commands, now with browser auth.</h2>
            </div>
          </div>
          <div className="panel">
            <div className="code-block">npm link ./packages/acm-cli{"\n\n"}acm login{"\n"}acm init .{"\n"}acm remote add origin https://acmhub.netlify.app/sxriptor/unlimited-rod-holders.acm{"\n"}acm add .{"\n"}acm commit -m &quot;sync rod holder runtime patch&quot;{"\n"}acm push origin main{"\n"}acm storage{"\n"}acm help</div>
          </div>
        </section>

        <section id="stack" className="page">
          <div className="page-header">
            <div>
              <div className="meta-label">Stack</div>
              <h2 className="page-title">Next.js, Supabase, and Cloudflare bucket-aware metadata.</h2>
            </div>
          </div>
          <div className="repo-grid">
            <article className="repo-card">
              <h3>Next.js app router</h3>
              <p className="repo-meta">Server-rendered owner dashboards, repo pages, and CLI approval screens.</p>
            </article>
            <article className="repo-card">
              <h3>Supabase auth + tables</h3>
              <p className="repo-meta">Email/password sign-in, profiles, repositories, commit history, CLI tokens, and storage quotas.</p>
            </article>
            <article className="repo-card">
              <h3>Cloudflare bucket targeting</h3>
              <p className="repo-meta">Bucket names for `repos`, `releases`, and `LFA` are now first-class env settings in the app.</p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
