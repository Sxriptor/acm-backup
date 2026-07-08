import { NextRequest, NextResponse } from "next/server";

import { createCliLoginSession } from "@/lib/cli-login";
import { getSiteUrl } from "@/lib/env";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label.slice(0, 120) : null;
  const session = await createCliLoginSession(label);

  return NextResponse.json({
    ok: true,
    userCode: session.user_code,
    deviceCode: session.device_code,
    verificationUrl: `${getSiteUrl()}/cli/login?code=${encodeURIComponent(session.user_code)}`,
    expiresAt: session.expires_at,
  });
}
