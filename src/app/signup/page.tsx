import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeUsername(input: string) {
  return input.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  async function signup(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const displayName = String(formData.get("displayName") ?? "").trim();
    const username = normalizeUsername(String(formData.get("username") ?? ""));
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName || username,
        },
      },
    });

    if (error) {
      redirect(`/signup?error=${encodeURIComponent(error.message)}`);
    }

    redirect("/login");
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card form-stack">
        <div>
          <div className="meta-label">Create account</div>
          <h1 className="page-title">Claim your ACM username.</h1>
          <p className="muted">That username becomes the owner segment in your `.acm` clone URLs.</p>
        </div>
        {params.error ? <div className="flash">{params.error}</div> : null}
        <form className="form-stack" action={signup}>
          <label>
            Display name
            <input className="input" type="text" name="displayName" required />
          </label>
          <label>
            Username
            <input className="input" type="text" name="username" required />
          </label>
          <label>
            Email
            <input className="input" type="email" name="email" required />
          </label>
          <label>
            Password
            <input className="input" type="password" name="password" required minLength={8} />
          </label>
          <button className="primary-button" type="submit">
            Create account
          </button>
        </form>
        <p className="muted">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
