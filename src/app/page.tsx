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
              Supabase handles password auth. The web app lists repos, stores commit history, and
              exposes `.acm` remotes. The `acm` CLI gives you the basic flow: `init`, `add`,
              `commit`, and `push`.
            </p>
            {!hasSupabaseEnv() ? (
              <div className="warning">
                Supabase env vars are not configured yet. Use `.env.example`, run the SQL migration,
                then come back to sign in.
              </div>
            ) : null}
            <div className="hero-stats">
              <div className="stat">
                <strong>1 folder</strong>
                <span className="caption">1 repo identity per `work/*` directory</span>
              </div>
              <div className="stat">
                <strong>Password auth</strong>
                <span className="caption">Supabase email/password only, no payments</span>
              </div>
              <div className="stat">
                <strong>.acm remotes</strong>
                <span className="caption">Clone URL pattern built around your username</span>
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
              <div className="code-block">acm init .{"\n"}acm add .{"\n"}acm commit -m &quot;first backup&quot;{"\n"}acm push origin main</div>
            </div>
            <div>
              <div className="meta-label">What gets stored</div>
              <div className="caption">
                Repo metadata in Supabase, commit manifests in the database, and a ready hook for
                Cloudflare bucket archives once you provide the bucket env values.
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
                Each repo page exposes the `.acm` clone URL, source path, and recent commit history.
              </p>
            </article>
            <article className="repo-card">
              <div className="repo-badge">Backup</div>
              <h3>Push manifests from the CLI</h3>
              <p className="repo-meta">
                The CLI signs in with Supabase credentials from env vars and pushes file manifests to the app.
              </p>
            </article>
          </div>
        </section>

        <section id="cli" className="page">
          <div className="page-header">
            <div>
              <div className="meta-label">CLI</div>
              <h2 className="page-title">Thin git-style commands, purpose-built for ACM.</h2>
            </div>
          </div>
          <div className="panel">
            <div className="code-block">npm link ./packages/acm-cli{"\n\n"}acm init .{"\n"}acm remote add origin https://acmhub.netlify.app/sxriptor/unlimited-rod-holders.acm{"\n"}acm add .{"\n"}acm commit -m &quot;sync rod holder runtime patch&quot;{"\n"}acm push origin main</div>
          </div>
        </section>

        <section id="stack" className="page">
          <div className="page-header">
            <div>
              <div className="meta-label">Stack</div>
              <h2 className="page-title">Next.js, Supabase, and a Cloudflare-ready storage seam.</h2>
            </div>
          </div>
          <div className="repo-grid">
            <article className="repo-card">
              <h3>Next.js app router</h3>
              <p className="repo-meta">Server-rendered owner dashboards and repo pages.</p>
            </article>
            <article className="repo-card">
              <h3>Supabase auth + tables</h3>
              <p className="repo-meta">Email/password sign-in, profiles, repositories, and commit history.</p>
            </article>
            <article className="repo-card">
              <h3>Cloudflare bucket later</h3>
              <p className="repo-meta">The archive storage function is already isolated so you can swap in R2 once you have the bucket URL and keys.</p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}

