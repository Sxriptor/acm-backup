import { createHash, randomBytes, randomUUID } from "crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CLI_TOKEN_PREFIX = "acm_";
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function randomToken(length = 32) {
  return `${CLI_TOKEN_PREFIX}${randomBytes(length).toString("hex")}`;
}

function randomUserCode() {
  let output = "";
  for (let index = 0; index < 8; index += 1) {
    output += USER_CODE_ALPHABET[Math.floor(Math.random() * USER_CODE_ALPHABET.length)];
  }
  return `${output.slice(0, 4)}-${output.slice(4)}`;
}

export async function createCliLoginSession(requestedLabel: string | null) {
  const admin = createSupabaseAdminClient();
  const payload = {
    user_code: randomUserCode(),
    device_code: randomUUID(),
    requested_label: requestedLabel,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };

  const { data, error } = await admin
    .from("cli_login_sessions")
    .insert(payload)
    .select("id, user_code, device_code, expires_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function approveCliLoginSession(userCode: string, ownerId: string) {
  const admin = createSupabaseAdminClient();
  const normalized = userCode.trim().toUpperCase();
  const { data: session, error } = await admin
    .from("cli_login_sessions")
    .select("id, status, expires_at, requested_label")
    .eq("user_code", normalized)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!session) {
    return { ok: false, error: "Code not found." };
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await admin.from("cli_login_sessions").update({ status: "expired" }).eq("id", session.id);
    return { ok: false, error: "Code expired. Start acm login again." };
  }

  if (session.status === "consumed") {
    return { ok: false, error: "Code already used." };
  }

  const rawToken = randomToken();
  const tokenHash = hashToken(rawToken);

  const { error: tokenError } = await admin.from("cli_tokens").insert({
    owner_id: ownerId,
    token_hash: tokenHash,
    token_name: session.requested_label || "CLI device",
  });

  if (tokenError) {
    throw tokenError;
  }

  const { error: updateError } = await admin
    .from("cli_login_sessions")
    .update({
      status: "approved",
      approved_by: ownerId,
      approved_token: rawToken,
      approved_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  if (updateError) {
    throw updateError;
  }

  return { ok: true };
}

export async function consumeCliLoginSession(deviceCode: string) {
  const admin = createSupabaseAdminClient();
  const { data: session, error } = await admin
    .from("cli_login_sessions")
    .select("id, status, expires_at, approved_token")
    .eq("device_code", deviceCode)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!session) {
    return { status: "not_found" as const };
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await admin.from("cli_login_sessions").update({ status: "expired" }).eq("id", session.id);
    return { status: "expired" as const };
  }

  if (session.status !== "approved" || !session.approved_token) {
    return { status: session.status as "pending" | "approved" | "expired" | "consumed" };
  }

  const token = session.approved_token;
  await admin
    .from("cli_login_sessions")
    .update({ status: "consumed", approved_token: null })
    .eq("id", session.id);

  return { status: "approved" as const, token };
}

export async function getCliTokenUser(rawToken: string) {
  const admin = createSupabaseAdminClient();
  const tokenHash = hashToken(rawToken);
  const { data: tokenRow, error: tokenError } = await admin
    .from("cli_tokens")
    .select("id, owner_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError) {
    throw tokenError;
  }

  if (!tokenRow) {
    return null;
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, username, display_name, storage_used_bytes, storage_quota_bytes")
    .eq("id", tokenRow.owner_id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  await admin.from("cli_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tokenRow.id);

  return {
    id: tokenRow.id,
    owner_id: tokenRow.owner_id,
    profile,
  };
}
