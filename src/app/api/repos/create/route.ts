import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/request-user";

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  sourcePath: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const actor = await getRequestUser(request);
  if (!actor?.profile) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("repositories")
    .upsert(
      {
        owner_id: actor.ownerId,
        slug: parsed.data.slug,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        source_path: parsed.data.sourcePath ?? null,
        visibility: "private",
      },
      { onConflict: "owner_id,slug" },
    )
    .select("id, slug, name, description, source_path, storage_used_bytes, storage_quota_bytes, current_bucket, created_at, updated_at, visibility")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, repository: data });
}
