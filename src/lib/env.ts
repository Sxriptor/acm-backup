import path from "path";

const requiredClientEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] as const;

export const MAX_ACCOUNT_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;
export const MAX_REPO_STORAGE_BYTES = 5 * 1024 * 1024 * 1024;
export const LARGE_FILE_ASSET_THRESHOLD_BYTES = 300 * 1024 * 1024;
export const MAX_SINGLE_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function hasSupabaseEnv() {
  return requiredClientEnv.every((name) => Boolean(process.env[name]));
}

export function getSupabaseUrl() {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey() {
  return requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

export function getSupabaseServiceRoleKey() {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export function getWorkRoot() {
  return process.env.ACM_WORK_ROOT || path.join(/* turbopackIgnore: true */ process.cwd(), "..", "work");
}

export function getReposBucketName() {
  return process.env.ACM_BUCKET_REPOS || "repos";
}

export function getReleasesBucketName() {
  return process.env.ACM_BUCKET_RELEASES || "releases";
}

export function getLargeFileAssetsBucketName() {
  return process.env.ACM_BUCKET_LFA || "LFA";
}
