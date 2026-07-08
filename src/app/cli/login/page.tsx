import Link from "next/link";
import { redirect } from "next/navigation";

import { getViewer } from "@/lib/auth";
import { approveCliLoginSession } from "@/lib/cli-login";

export default async function CliLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const code = (params.code || "").trim().toUpperCase();
  const viewer = await getViewer().catch(() => null);

  async function approve() {
    "use server";

    const currentViewer = await getViewer();
    if (!currentViewer) {
      redirect(`/login?next=${encodeURIComponent(`/cli/login?code=${code}`)}`);
    }

    const result = await approveCliLoginSession(code, currentViewer.id);
    if (!result.ok) {
      redirect(`/cli/login?code=${encodeURIComponent(code)}&error=${encodeURIComponent(result.error || "Authorization failed")}`);
    }

    redirect(`/cli/login?code=${encodeURIComponent(code)}&success=1`);
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card form-stack">
        <div>
          <div className="meta-label">CLI Login</div>
          <h1 className="page-title">Authorize ACM in your browser.</h1>
          <p className="muted">Approve this code to let your terminal CLI use your ACM account without typing your password into the shell.</p>
        </div>
        <div className="code-block">{code || "Missing login code"}</div>
        {!viewer ? (
          <div className="warning">
            Sign in on the website first, then reopen this page or return here after login.
          </div>
        ) : null}
        {params.error ? <div className="flash">{params.error}</div> : null}
        {params.success ? (
          <div className="panel">
            <strong>Authorized.</strong>
            <p className="muted">Return to the terminal. `acm login` will finish automatically.</p>
          </div>
        ) : (
          <form action={approve} className="form-stack">
            <button className="primary-button" type="submit" disabled={!viewer || !code}>
              Approve CLI login
            </button>
          </form>
        )}
        <p className="muted">
          Need a regular session first? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

