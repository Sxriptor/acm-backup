import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  async function login(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user?.id ?? "")
      .maybeSingle();

    redirect(profile?.username ? `/u/${profile.username}` : "/signup?error=Finish your profile setup");
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card form-stack">
        <div>
          <div className="meta-label">Sign in</div>
          <h1 className="page-title">Open your ACM backup hub.</h1>
          <p className="muted">Use Supabase email and password auth. No OAuth flow is required.</p>
        </div>
        {params.error ? <div className="flash">{params.error}</div> : null}
        <form className="form-stack" action={login}>
          <label>
            Email
            <input className="input" type="email" name="email" required />
          </label>
          <label>
            Password
            <input className="input" type="password" name="password" required />
          </label>
          <button className="primary-button" type="submit">
            Sign in
          </button>
        </form>
        <p className="muted">
          Need an account? <Link href="/signup">Create one</Link>
        </p>
      </div>
    </main>
  );
}
