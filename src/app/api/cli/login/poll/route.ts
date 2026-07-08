import { NextRequest, NextResponse } from "next/server";

import { consumeCliLoginSession } from "@/lib/cli-login";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const deviceCode = typeof body.deviceCode === "string" ? body.deviceCode : "";

  if (!deviceCode) {
    return NextResponse.json({ error: "deviceCode is required" }, { status: 400 });
  }

  const result = await consumeCliLoginSession(deviceCode);
  return NextResponse.json(result);
}
